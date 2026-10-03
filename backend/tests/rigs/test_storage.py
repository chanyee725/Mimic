import logging

import yaml

from app.core import storage
from app.services import rigs as service


def test_seed_writes_rig_files_only():
    files = [p.name for p in storage.list_yaml("rigs")]
    assert files == ["so101-bimanual-kit.yaml", "so101-kit.yaml"]
    assert not storage.exists("devices")  # devices are live state, kept in memory
    doc = storage.read("rigs/so101-kit.yaml")
    assert doc["id"] == "so101-kit" and doc["robot"]["id"] == "follower"
    assert doc["rates"]["action_hz"] == 60 and "master" not in doc


def test_reload_restores_hand_edits():
    doc = storage.read("rigs/so101-kit.yaml")
    doc["name"] = "Edited kit"
    storage.write("rigs/so101-kit.yaml", doc)
    service.reset()
    assert service.require_rig("so101-kit").name == "Edited kit"
    assert [r.id for r in service.list_rigs()] == ["so101-kit", "so101-bimanual-kit"]


def test_folder_holds_only_the_kept_rigs():
    storage.delete("rigs/so101-bimanual-kit.yaml")
    service.reset()
    assert [r.id for r in service.list_rigs()] == ["so101-kit"]


def test_new_rig_file_is_loaded(client):
    doc = storage.read("rigs/so101-kit.yaml") | {"id": "lab-kit", "name": "Lab kit"}
    storage.write("rigs/lab.yaml", doc)  # id comes from content, not the file name
    service.reset()
    assert [r["id"] for r in client.get("/rigs").json()][-1] == "lab-kit"


def test_calibration_is_not_written(client):
    assert client.post("/devices/follower/calibrate").status_code == 202
    assert service.require_device("follower").calibration.done is True
    assert not storage.exists("devices")


def test_broken_files_are_skipped(caplog):
    storage.write_text("rigs/broken.yaml", "id: [unclosed\n")
    storage.write("rigs/invalid.yaml", {"id": "invalid", "name": "No fields"})
    with caplog.at_level(logging.WARNING, logger="app.services.rigs"):
        service.reset()
    assert [r.id for r in service.list_rigs()] == ["so101-kit", "so101-bimanual-kit"]
    assert sum("Skipping" in r.message for r in caplog.records) == 2


def test_files_are_snake_case_yaml():
    text = storage.read_text("rigs/so101-kit.yaml")
    assert "action_hz_options" in text and "actionHzOptions" not in text
    assert yaml.safe_load(text)["id"] == "so101-kit"

import logging

import yaml

from app.core import storage
from app.services import rigs as service


def test_seed_writes_files():
    files = [p.name for p in storage.list_yaml("rigs")]
    assert files == ["so101-bimanual-kit.yaml", "so101-kit.yaml"]
    assert len(storage.list_yaml("devices")) == 11
    doc = storage.read("rigs/so101-kit.yaml")
    assert doc["id"] == "so101-kit" and "target_hz" in doc and "targetHz" not in doc
    assert storage.read("devices/top.yaml")["calibration"].keys() == {"done", "note"}


def test_reload_restores_hand_edits():
    doc = storage.read("rigs/so101-kit.yaml")
    doc["name"] = "Edited kit"
    storage.write("rigs/so101-kit.yaml", doc)
    new = storage.read("devices/top.yaml") | {"id": "side-cam", "name": "Side camera"}
    storage.write("devices/side.yaml", new)  # id comes from content, not the file name

    service.reset()
    assert service.require_rig("so101-kit").name == "Edited kit"
    assert [r.id for r in service.list_rigs()] == ["so101-kit", "so101-bimanual-kit"]
    assert service.require_device("side-cam").name == "Side camera"
    assert len(service.list_devices()) == 12


def test_new_rig_file_is_loaded(client):
    doc = storage.read("rigs/so101-kit.yaml") | {"id": "lab-kit", "name": "Lab kit"}
    storage.write("rigs/lab-kit.yaml", doc)
    service.reset()
    assert [r["id"] for r in client.get("/rigs").json()][-1] == "lab-kit"


def test_folders_load_independently():
    storage.delete("rigs/so101-kit.yaml")
    for p in storage.list_yaml("devices"):
        p.unlink()
    storage.path("devices").rmdir()
    service.reset()
    assert [r.id for r in service.list_rigs()] == ["so101-bimanual-kit"]  # folder kept as is
    assert len(service.list_devices()) == 11  # reseeded
    assert len(storage.list_yaml("devices")) == 11


def test_finished_calibration_survives_reload(client):
    assert client.post("/devices/follower/calibrate").status_code == 202
    saved = storage.read("devices/follower.yaml")["calibration"]
    assert saved["done"] is True and saved["note"].startswith("Calibrated")
    service.reset()
    assert service.require_device("follower").calibration.done is True


def test_calibrating_state_is_not_persisted():
    before = storage.read("devices/follower.yaml")
    service.start_calibration("follower")
    assert storage.read("devices/follower.yaml") == before
    service.reset()
    assert service.require_device("follower").calibration.note != service.CALIBRATING


def test_broken_files_are_skipped(caplog):
    storage.write_text("rigs/broken.yaml", "id: [unclosed\n")
    storage.write("rigs/invalid.yaml", {"id": "invalid", "name": "No fields"})
    storage.write_text("devices/empty.yaml", "")
    with caplog.at_level(logging.WARNING, logger="app.services.rigs"):
        service.reset()
    assert [r.id for r in service.list_rigs()] == ["so101-kit", "so101-bimanual-kit"]
    assert len(service.list_devices()) == 11
    assert sum("Skipping" in r.message for r in caplog.records) == 3


def test_files_are_snake_case_yaml():
    text = storage.read_text("devices/follower.yaml")
    assert "target_hz" in text and "measured_hz" in text
    assert yaml.safe_load(text)["id"] == "follower"

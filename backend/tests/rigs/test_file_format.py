import json
import logging
import shutil
from pathlib import Path

import pytest
import yaml
from pydantic import ValidationError

from app.configs.config import REPO_ROOT
from app.core import storage
from app.models.rigs import Rig
from app.services import rigs as service
from app.services.rigs import file_format as rigs_file
from app.services.rigs import rigs as rigs_store
from app.services.rigs.file_format import RigFile

# /rigs JSON captured before the rig file format changed; /devices as reported with no drivers
SNAPSHOT = json.loads((Path(__file__).parent / "data" / "api_snapshot.json").read_text())


def _rig(rig_id: str) -> dict:
    return next(r for r in SNAPSHOT["rigs"] if r["id"] == rig_id)


def _devices(*ids: str) -> list[dict]:
    by_id = {d["id"]: d for d in SNAPSHOT["devices"]}
    return [by_id[i] for i in ids]


def test_fixture_api_matches_snapshot(client):
    by_id = {r["id"]: r for r in client.get("/rigs").json()}
    assert [by_id[r["id"]] for r in SNAPSHOT["rigs"]] == SNAPSHOT["rigs"]
    devices = {d["id"]: d for d in client.get("/devices").json()}
    assert [devices[d["id"]] for d in SNAPSHOT["devices"]] == SNAPSHOT["devices"]


def test_committed_file_matches_snapshot(client):
    shutil.copy(REPO_ROOT / "data" / "rigs" / "so101-kit.yaml", storage.path("rigs"))
    storage.delete("rigs/so101-bimanual-kit.yaml")
    service.reset()
    assert client.get("/rigs").json() == [_rig("so101-kit")]
    # Only devices declared by a rig file exist
    assert client.get("/devices").json() == _devices("follower", "leader", "top", "wrist")
    # Hand-written comments are kept (the file is not rewritten)
    assert storage.read_text("rigs/so101-kit.yaml").startswith(
        "id: so101-kit\nname: SO-101 Kit\n\n#"
    )


@pytest.mark.parametrize("rig_id", ["so101-kit", "so101-bimanual-kit"])
def test_round_trip(rig_id):
    spec = rigs_store._specs[rig_id]
    again = RigFile.model_validate(yaml.safe_load(rigs_file.dumps(spec)))
    assert again == spec
    assert rigs_file.to_rig(again).model_dump(by_alias=True) == _rig(rig_id)


def test_singular_and_plural_shapes():
    single = storage.read("rigs/so101-kit.yaml")
    assert "robot" in single and "robots" not in single and "device" in single
    assert "id" not in single["cameras"]["top"]  # id defaults to the key
    bi = storage.read("rigs/so101-bimanual-kit.yaml")
    assert list(bi["robots"]) == ["bi-follower-l", "bi-follower-r"]
    assert list(bi["devices"]) == ["bi-leader-l", "bi-leader-r"]
    assert bi["cameras"]["left_wrist"]["id"] == "bi-cam-wrist-l"
    # Plural maps with one entry load too
    doc = single | {"robots": {"follower": single["robot"]}}
    del doc["robot"], doc["robots"]["follower"]["id"]
    assert rigs_file.to_rig(RigFile.model_validate(doc)).model_dump(by_alias=True) == _rig(
        "so101-kit"
    )


def test_label():
    assert rigs_file.label(["SO-101 Follower"]) == "SO-101 Follower"
    assert rigs_file.label(["SO-101 Follower (L)", "SO-101 Follower (R)"]) == "SO-101 Follower ×2"
    assert rigs_file.label(["Arm A", "Arm B"]) == "Arm A + Arm B"


def test_camera_only_in_file_gets_default_device(client):
    doc = storage.read("rigs/so101-kit.yaml")
    doc["cameras"]["side"] = {
        "name": "Side camera",
        "port": "/dev/cam_side",
        "resolution": "1280×720",
    }
    storage.write("rigs/so101-kit.yaml", doc)
    service.reset()
    cam = client.get("/rigs/so101-kit").json()["cameras"][-1]
    assert cam == {
        "id": "side",
        "key": "side",
        "name": "Side camera",
        "feature": "observation.images.side",
        "resolution": "1280×720",
        "fps": 30,
        "defaultOn": True,
    }
    d = client.get("/devices/side").json()
    assert d["type"] == "camera" and d["health"] == "off" and d["port"] == "/dev/cam_side"
    assert d["calibration"] == {"done": True, "note": "Not required"} and d["stats"] == []
    assert d["streams"] == [
        {
            "key": "images.side",
            "shape": "720×1280×3",
            "targetHz": 30,
            "measuredHz": None,
            "unit": "fps",
        }
    ]
    assert [x["id"] for x in client.get("/rigs/so101-kit/devices").json()][-1] == "side"
    assert client.post("/devices/side/calibrate").status_code == 400  # cameras are not calibrated


def test_file_overrides_device_identity(client):
    doc = storage.read("rigs/so101-kit.yaml")
    doc["robot"]["port"] = "/dev/ttyACM1"
    doc["robot"]["name"] = "Arm"
    storage.write("rigs/so101-kit.yaml", doc)
    service.reset()
    d = client.get("/devices/follower").json()
    assert d["port"] == "/dev/ttyACM1" and d["name"] == "Arm" and d["health"] == "off"
    assert client.get("/rigs/so101-kit").json()["slave"] == "Arm"


def test_new_robot_defaults():
    doc = storage.read("rigs/so101-kit.yaml") | {"id": "lab-kit"}
    doc["robot"] = doc["robot"] | {"id": "lab-arm"}
    doc["device"] = doc["device"] | {"id": "lab-leader"}
    doc["cameras"] = {}
    storage.write("rigs/lab.yaml", doc)
    service.reset()
    arm, leader = service.rig_devices("lab-kit")
    assert (arm.type, arm.health, arm.streams[0].key, arm.streams[0].shape) == (
        "robot",
        "off",
        "observation.state",
        "[6]",
    )
    assert (leader.type, leader.streams[0].key, leader.streams[0].target_hz) == (
        "teleop",
        "action",
        60,
    )


def test_old_format_is_migrated(client):
    old = Rig.model_validate(_rig("so101-kit")).model_dump(mode="json")
    storage.write("rigs/so101-kit.yaml", old)
    assert "master" in storage.read("rigs/so101-kit.yaml")
    service.reset()
    doc = storage.read("rigs/so101-kit.yaml")
    # Old files carry no ports: names come from master / slave, ports start empty
    assert "master" not in doc and doc["robot"]["name"] == "SO-101 Follower"
    assert doc["robot"]["port"] == ""
    assert client.get("/rigs/so101-kit").json() == _rig("so101-kit")


def _base() -> dict:
    return storage.read("rigs/so101-kit.yaml")


@pytest.mark.parametrize(
    "edit",
    [
        lambda d: d.pop("robot"),
        lambda d: d.pop("rates"),
        lambda d: d["rates"].update(action_hz=45),
        lambda d: d["rates"].update(video_fps=0),
        lambda d: d["cameras"]["top"].pop("resolution"),
        lambda d: d["cameras"]["top"].update(resolution="large"),
        lambda d: d["robot"].update(joints=[]),
        lambda d: d.update(robots={"x": d["robot"]}),  # both robot and robots
        lambda d: d["cameras"]["top"].update(id="leader"),  # duplicate device id
    ],
)
def test_invalid_files_are_skipped(edit, caplog):
    doc = _base() | {"id": "bad-kit"}
    edit(doc)
    storage.write("rigs/bad.yaml", doc)
    with caplog.at_level(logging.WARNING, logger="app.services.rigs"):
        service.reset()
    assert "bad-kit" not in [r.id for r in service.list_rigs()]
    assert any("Skipping" in r.message and "bad.yaml" in r.message for r in caplog.records)


def test_robots_must_share_joint_count():
    doc = storage.read("rigs/so101-bimanual-kit.yaml")
    doc["robots"]["bi-follower-r"]["joints"] = ["a", "b"]
    with pytest.raises(ValidationError, match="same number of joints"):
        RigFile.model_validate(doc)
    doc["robots"]["bi-follower-r"]["joints"] = doc["robots"]["bi-follower-l"]["joints"]
    with pytest.raises(ValidationError, match="unique"):
        RigFile.model_validate(doc)


def test_unknown_keys_warn_but_load(caplog):
    doc = _base()
    doc["notes"] = "bench 2"
    doc["cameras"]["top"]["exposure"] = "auto"
    storage.write("rigs/so101-kit.yaml", doc)
    with caplog.at_level(logging.WARNING, logger="app.services.rigs"):
        service.reset()
    assert service.require_rig("so101-kit").cameras[0].resolution == "640×480"
    msg = next(r.message for r in caplog.records if "unknown keys" in r.message)
    assert "notes" in msg and "cameras.top.exposure" in msg


def test_resolution_accepts_x_or_times():
    doc = _base()
    doc["cameras"]["top"]["resolution"] = "640 × 480"
    assert RigFile.model_validate(doc).cameras[0].resolution == "640×480"

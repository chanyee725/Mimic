import time

import pytest

from app.core import storage
from app.services import rigs as service
from app.services.rigs import driver, ports
from tests.support import FakeDriver


@pytest.fixture
def fake(tmp_path, monkeypatch):
    d = FakeDriver(tmp_path / "calibration")
    d.calibration_dir.mkdir()
    monkeypatch.setattr(ports, "exists", lambda p: True)
    driver.use(d)
    service.reset()
    yield d
    driver.use(None)
    service.reset()


def _wait(client, ok, timeout: float = 2.0) -> dict:
    deadline = time.monotonic() + timeout
    while True:
        r = client.get("/rigs/so101-kit/teleop")
        if ok(r) or time.monotonic() > deadline:
            return r.json()
        time.sleep(0.02)


def test_teleop_start_state_stop(client, fake):
    r = client.post("/rigs/so101-kit/teleop")
    assert r.status_code == 201
    s = r.json()
    assert s["rigId"] == "so101-kit" and s["running"] is True and s["targetHz"] == 60
    assert s["error"] is None and s["startedAt"]
    assert [(p["robot"], p["teleop"]) for p in s["pairs"]] == [("follower", "leader")]

    s = _wait(client, lambda r: r.json()["pairs"][0]["joints"][0]["follower"] is not None)
    joint = s["pairs"][0]["joints"][0]
    assert joint == {"name": "shoulder_pan", "leader": 10.0, "follower": 10.0}
    assert fake.teleop.steps > 0

    assert client.post("/rigs/so101-kit/teleop").status_code == 409
    assert client.delete("/rigs/so101-kit/teleop").status_code == 204
    assert fake.teleop.closed is True
    assert client.get("/rigs/so101-kit/teleop").status_code == 404
    assert client.delete("/rigs/so101-kit/teleop").status_code == 404


def test_teleop_rate_is_measured(client, fake):
    client.post("/rigs/so101-kit/teleop")
    s = _wait(client, lambda r: r.json()["hz"] is not None, timeout=3)
    assert 30 < s["hz"] <= 70
    client.delete("/rigs/so101-kit/teleop")


def test_bimanual_pairs(client, fake):
    s = client.post("/rigs/so101-bimanual-kit/teleop").json()
    assert [(p["robot"], p["teleop"]) for p in s["pairs"]] == [
        ("bi-follower-l", "bi-leader-l"),
        ("bi-follower-r", "bi-leader-r"),
    ]
    client.delete("/rigs/so101-bimanual-kit/teleop")


def test_devices_are_busy_while_running(client, fake):
    client.post("/rigs/so101-kit/teleop")
    assert client.post("/devices/follower/test").status_code == 409
    assert client.post("/devices/leader/calibrate").status_code == 409
    assert client.put("/devices/leader/port", json={"port": "/dev/ttyACM1"}).status_code == 409
    assert client.post("/devices/top/test").status_code == 200  # cameras are not used
    client.delete("/rigs/so101-kit/teleop")
    assert client.post("/devices/follower/test").status_code == 200


def test_step_error_stops_the_session(client, fake):
    client.post("/rigs/so101-kit/teleop")
    fake.teleop.fail = "Incorrect status packet"
    s = _wait(client, lambda r: r.json()["running"] is False)
    assert s["running"] is False and s["error"] == "Incorrect status packet"
    assert fake.teleop.closed is True
    # A stopped session can be replaced
    assert client.post("/rigs/so101-kit/teleop").status_code == 201
    client.delete("/rigs/so101-kit/teleop")


def test_teleop_refused(client, fake, monkeypatch):
    client.post("/devices/leader/calibrate")
    assert client.post("/rigs/so101-kit/teleop").status_code == 409
    client.delete("/devices/leader/calibration")

    monkeypatch.setattr(ports, "exists", lambda p: p != "/dev/so101_follower")
    r = client.post("/rigs/so101-kit/teleop")
    assert (
        r.status_code == 503
        and r.json()["error"]["message"] == "Port not found: /dev/so101_follower"
    )

    doc = storage.read("rigs/so101-kit.yaml")
    del doc["device"]
    storage.write("rigs/so101-kit.yaml", doc)
    service.reset()
    r = client.post("/rigs/so101-kit/teleop")
    assert r.status_code == 400 and "one leader per follower" in r.json()["error"]["message"]
    assert client.post("/rigs/missing/teleop").status_code == 404


def test_teleop_without_driver(client, monkeypatch):
    monkeypatch.setattr(ports, "exists", lambda p: True)
    assert client.post("/rigs/so101-kit/teleop").status_code == 503

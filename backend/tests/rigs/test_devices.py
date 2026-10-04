import time

import pytest

from app.core import storage
from app.services import rigs as service
from app.services.rigs import driver, ports, preview
from tests.support import FakeDriver


@pytest.fixture
def fake(tmp_path, monkeypatch):
    """Fake LeRobot driver; every port in `present` exists."""
    d = FakeDriver(tmp_path / "calibration")
    d.calibration_dir.mkdir()
    present = {"/dev/so101_follower", "/dev/so101_leader", "/dev/cam_top", "/dev/cam_wrist"}
    monkeypatch.setattr(ports, "exists", lambda p: p in present)
    driver.use(d)
    service.reset()
    yield d
    driver.use(None)
    service.reset()


def _wait(client, path: str, ok, timeout: float = 2.0) -> dict:
    deadline = time.monotonic() + timeout
    while True:
        body = client.get(path).json()
        if ok(body) or time.monotonic() > deadline:
            return body
        time.sleep(0.02)


# --- ports ------------------------------------------------------------------


def test_scan_ports(client, tmp_path, monkeypatch):
    dev, sys_video = tmp_path / "dev", tmp_path / "video4linux"
    (dev / "serial" / "by-id").mkdir(parents=True)
    (dev / "ttyACM0").touch()
    (dev / "serial" / "by-id" / "usb-1a86_Serial_ABC-if00").symlink_to(dev / "ttyACM0")
    for name, index in (("video0", "0"), ("video1", "1")):
        (dev / name).touch()
        (sys_video / name).mkdir(parents=True)
        (sys_video / name / "index").write_text(index)
        (sys_video / name / "name").write_text("Cam X: Cam X\n")
    # Video ports use the USB position; the usb- link sorts before its usbv2- twin
    (dev / "v4l" / "by-path").mkdir(parents=True)
    for name in ("pci-0-usb-0:2.4:1.0-video-index0", "pci-0-usbv2-0:2.4:1.0-video-index0"):
        (dev / "v4l" / "by-path" / name).symlink_to(dev / "video0")
    monkeypatch.setattr(ports, "DEV", dev)
    monkeypatch.setattr(ports, "SYS_VIDEO", sys_video)
    monkeypatch.setattr(ports, "SYS_TTY", tmp_path / "tty")

    link = str(dev / "serial" / "by-id" / "usb-1a86_Serial_ABC-if00")
    rows = client.get("/devices/ports").json()
    assert [(r["kind"], r["path"], r["device"]) for r in rows] == [
        ("serial", link, str(dev / "ttyACM0")),
        # video1 is a metadata node
        (
            "video",
            str(dev / "v4l" / "by-path" / "pci-0-usb-0:2.4:1.0-video-index0"),
            str(dev / "video0"),
        ),
    ]
    assert rows[0]["label"] == "usb-1a86_Serial_ABC-if00" and rows[1]["label"] == "Cam X"
    assert rows[0]["usedBy"] == []
    service.set_port("leader", str(dev / "ttyACM0"))  # matched by kernel node too
    assert client.get("/devices/ports").json()[0]["usedBy"] == ["leader"]


def test_set_port_writes_rig_file(client):
    before = storage.read_text("rigs/so101-kit.yaml")
    r = client.put("/devices/leader/port", json={"port": "/dev/serial/by-id/usb-arm"})
    assert r.status_code == 200 and r.json()["port"] == "/dev/serial/by-id/usb-arm"
    after = storage.read_text("rigs/so101-kit.yaml")
    # Only the port value changes; comments and layout stay
    assert after == before.replace("port: /dev/so101_leader", "port: /dev/serial/by-id/usb-arm")
    assert not storage.exists("ports.local.yaml")
    client.put("/devices/top/port", json={"port": "/dev/v4l/by-id/cam top"})
    assert storage.read("rigs/so101-kit.yaml")["cameras"]["top"]["port"] == "/dev/v4l/by-id/cam top"
    # Bimanual maps keyed by id
    client.put("/devices/bi-leader-r/port", json={"port": "/dev/ttyACM3"})
    assert (
        storage.read("rigs/so101-bimanual-kit.yaml")["devices"]["bi-leader-r"]["port"]
        == "/dev/ttyACM3"
    )
    service.reset()
    assert client.get("/devices/leader").json()["port"] == "/dev/serial/by-id/usb-arm"
    assert client.get("/devices/bi-leader-r").json()["port"] == "/dev/ttyACM3"
    assert client.put("/devices/leader/port", json={"port": "COM3"}).status_code == 400
    assert client.put("/devices/missing/port", json={"port": "/dev/x"}).status_code == 404


def test_rig_yaml_is_the_file(client):
    storage.write_text(
        "rigs/so101-kit.yaml", "# hand note\n" + storage.read_text("rigs/so101-kit.yaml")
    )
    service.reset()
    assert client.get("/rigs/so101-kit/yaml").text.startswith("# hand note\n")


# --- camera preview ---------------------------------------------------------


@pytest.fixture
def video_port(monkeypatch):
    from app.models.rigs import Port

    port = Port(
        path="/dev/v4l/by-id/cam", device="/dev/video6", kind="video", label="Cam", used_by=[]
    )
    serial = Port(path="/dev/ttyACM0", device="/dev/ttyACM0", kind="serial", label="", used_by=[])
    monkeypatch.setattr(ports, "scan", lambda: [serial, port])
    return port


def test_preview_streams_jpeg(client, fake, video_port):
    r = client.get("/devices/ports/preview", params={"path": "/dev/video6"})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("multipart/x-mixed-replace; boundary=frame")
    assert r.content.count(b"--frame\r\nContent-Type: image/jpeg") == 3
    assert fake.opened_cameras == ["/dev/video6"] and fake.released_cameras == 1


def test_preview_only_scanned_video_ports(client, fake, video_port):
    for path in ("/etc/passwd", "/dev/ttyACM0"):
        r = client.get("/devices/ports/preview", params={"path": path})
        assert r.status_code == 400
    assert fake.opened_cameras == []


def test_preview_is_released_when_the_camera_is_opened_again(fake, video_port, monkeypatch):
    # A client that never hangs up (browsers may keep MJPEG requests open) must not hold the camera
    monkeypatch.setattr(preview, "node", lambda port: "/dev/video6")
    first = service.open_preview("/dev/video6")
    assert first.next() is not None
    second = service.open_preview("/dev/v4l/by-id/cam")  # same camera, other path
    assert second.next() is not None  # the route always reads the first frame
    assert first.closed and first.next() is None and fake.released_cameras == 1
    assert not second.closed
    # A connection test of the device on that camera closes the preview too
    monkeypatch.setattr(ports, "exists", lambda p: True)
    service.set_port("top", "/dev/video6")
    assert service.test_device("top").check.ok is True
    assert second.closed and fake.released_cameras == 2


def test_preview_without_driver(client, video_port):
    r = client.get("/devices/ports/preview", params={"path": "/dev/v4l/by-id/cam"})
    assert r.status_code == 503


# --- connection test --------------------------------------------------------


def test_connection_test_without_driver(client):
    r = client.post("/devices/follower/test")
    assert r.status_code == 503 and r.json()["error"]["code"] == "unavailable"


def test_arm_connection_test(client, fake):
    d = client.post("/devices/follower/test").json()
    assert d["health"] == "ok" and d["check"]["ok"] is True
    assert d["check"]["message"] == "All motors answered"
    assert {s["label"]: s["value"] for s in d["stats"]} == {
        "Motors": "6/6",
        "Voltage": "12.1 V",
        "Temperature": "31 °C",
    }
    fake.missing = ["gripper"]
    d = client.post("/devices/follower/test").json()
    assert d["health"] == "warn" and d["check"]["message"] == "Missing motors: gripper"


def test_connection_test_missing_port(client, fake):
    client.put("/devices/follower/port", json={"port": "/dev/ttyACM9"})
    r = client.post("/devices/follower/test")
    # A failed test is a result, not an error
    assert r.status_code == 200
    d = r.json()
    assert d["health"] == "off" and d["check"] == {
        "ok": False,
        "message": "Port not found: /dev/ttyACM9",
        "at": d["check"]["at"],
    }


def test_camera_connection_test(client, fake):
    d = client.post("/devices/top/test").json()
    assert d["health"] == "ok" and d["streams"][0]["measuredHz"] == 30.0
    assert {s["label"]: s["value"] for s in d["stats"]}["Resolution"] == "640×480"
    fake.camera_fps = 20.0
    d = client.post("/devices/top/test").json()
    assert d["health"] == "warn" and d["check"]["message"] == "Frames at 20.0 fps (target 30)"


def test_calibration_file_marks_device_calibrated(client, fake):
    assert client.get("/devices/follower").json()["calibration"] == {
        "done": False,
        "note": "Required",
    }
    (fake.calibration_dir / "follower.json").write_text("{}")
    service.reset()
    cal = client.get("/devices/follower").json()["calibration"]
    assert cal["done"] is True and cal["note"].startswith("Calibrated · ")
    assert client.get("/devices/top").json()["calibration"]["note"] == "Not required"


# --- calibration ------------------------------------------------------------


def test_calibration_flow(client, fake):
    r = client.post("/devices/follower/calibrate")
    assert r.status_code == 201
    s = r.json()
    assert s["step"] == "center" and s["file"] is None
    assert [m["name"] for m in s["motors"]][0] == "shoulder_pan"
    assert client.get("/devices/follower").json()["calibration"]["note"] == "Calibrating…"
    assert client.post("/devices/follower/calibrate").status_code == 409
    assert client.post("/devices/follower/test").status_code == 409

    s = client.post("/devices/follower/calibration/next").json()
    assert s["step"] == "range"
    wrist = next(m for m in s["motors"] if m["name"] == "wrist_roll")
    assert wrist["fullTurn"] is True and wrist["min"] is None
    # Nothing moved yet
    r = client.post("/devices/follower/calibration/next")
    assert r.status_code == 409 and "shoulder_pan" in r.json()["error"]["details"]["motors"]

    for m in fake.arm.motors:
        fake.arm.pos[m] = 1000
    s = _wait(client, "/devices/follower/calibration", lambda b: b["motors"][0]["min"] == 1000)
    for m in fake.arm.motors:
        fake.arm.pos[m] = 3000
    _wait(client, "/devices/follower/calibration", lambda b: b["motors"][0]["max"] == 3000)

    s = client.post("/devices/follower/calibration/next").json()
    assert s["step"] == "done" and s["file"] == "/calibration/so_follower/follower.json"
    homings, mins, maxes = fake.arm.saved
    assert homings["shoulder_pan"] == 100 and "wrist_roll" not in mins
    assert mins["gripper"] == 1000 and maxes["gripper"] == 3000
    assert fake.arm.closed is True
    assert client.post("/devices/follower/calibration/next").status_code == 409


def test_calibration_cancel(client, fake):
    client.post("/devices/leader/calibrate")
    assert client.delete("/devices/leader/calibration").status_code == 204
    assert fake.arm.closed is True
    assert client.get("/devices/leader").json()["calibration"]["note"] == "Required"
    assert client.get("/devices/leader/calibration").status_code == 404


def test_calibration_errors(client, fake):
    assert client.post("/devices/missing/calibrate").status_code == 404
    assert client.post("/devices/top/calibrate").status_code == 400
    assert client.get("/devices/follower/calibration").status_code == 404
    client.put("/devices/follower/port", json={"port": "/dev/ttyACM9"})
    r = client.post("/devices/follower/calibrate")
    assert r.status_code == 503 and "Port not found" in r.json()["error"]["message"]


def test_calibration_without_driver(client, monkeypatch):
    monkeypatch.setattr(ports, "exists", lambda p: True)
    r = client.post("/devices/follower/calibrate")
    assert r.status_code == 503

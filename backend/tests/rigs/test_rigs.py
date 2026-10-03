import yaml


def test_list_rigs(client):
    rows = client.get("/rigs").json()
    # Sorted by file name
    assert [r["id"] for r in rows] == ["so101-bimanual-kit", "so101-kit"]
    assert rows[1]["targetHz"] == {"action": 60, "video": 30}


def test_get_rig(client):
    assert client.get("/rigs/so101-kit").json()["actionHzOptions"] == [30, 60]
    r = client.get("/rigs/missing")
    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"


def test_rig_yaml(client):
    r = client.get("/rigs/so101-kit/yaml")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/yaml")
    doc = yaml.safe_load(r.text)
    assert doc["id"] == "so101-kit" and doc["robot"]["port"] == "/dev/so101_follower"
    assert doc["device"]["id"] == "leader" and doc["cameras"]["top"]["resolution"] == "640x480"
    assert doc["rates"] == {
        "action_hz": 60,
        "video_fps": 30,
        "action_hz_options": [30, 60],
        "video_fps_options": [15, 30],
    }
    bi = yaml.safe_load(client.get("/rigs/so101-bimanual-kit/yaml").text)
    assert list(bi["robots"]) == ["bi-follower-l", "bi-follower-r"] and "robot" not in bi
    assert client.get("/rigs/missing/yaml").status_code == 404


def test_rig_devices_order(client):
    ids = [d["id"] for d in client.get("/rigs/so101-bimanual-kit/devices").json()]
    assert ids == [
        "bi-follower-l",
        "bi-follower-r",
        "bi-leader-l",
        "bi-leader-r",
        "bi-cam-top",
        "bi-cam-wrist-l",
        "bi-cam-wrist-r",
    ]
    assert client.get("/rigs/missing/devices").status_code == 404


def test_devices_are_not_connected(client):
    # No drivers yet: nothing live is reported
    rows = client.get("/devices").json()
    assert len(rows) == 11
    for d in rows:
        assert d["health"] == "off" and d["stats"] == []
        assert d["calibration"] == {"done": False, "note": "Not connected"}
        assert all(s["measuredHz"] is None and s["targetHz"] for s in d["streams"])
    d = client.get("/devices/top").json()
    assert d["streams"][0] == {
        "key": "images.top",
        "shape": "480×640×3",
        "targetHz": 30,
        "measuredHz": None,
        "unit": "fps",
    }
    assert client.get("/devices/missing").status_code == 404


def test_calibrate_off_device(client):
    r = client.post("/devices/follower/calibrate")
    assert r.status_code == 503 and r.json()["error"]["code"] == "unavailable"


def test_calibrate_device(client, devices_online):
    r = client.post("/devices/follower/calibrate")
    assert r.status_code == 202
    assert r.json()["calibration"]["done"] is False
    # The mock finishes in the background task
    cal = client.get("/devices/follower").json()["calibration"]
    assert cal["done"] is True and cal["note"].startswith("Calibrated")


def test_no_rigs_without_files(client):
    from app.core import storage
    from app.services import rigs as service

    for p in storage.list_yaml("rigs"):
        p.unlink()
    service.reset()
    assert client.get("/rigs").json() == [] and client.get("/devices").json() == []
    assert not storage.list_yaml("rigs")  # nothing seeded


def test_calibrate_errors(client):
    assert client.post("/devices/missing/calibrate").status_code == 404
    r = client.post("/devices/bi-leader-l/calibrate")
    assert r.status_code == 503 and r.json()["error"]["code"] == "unavailable"


def test_calibrate_twice(client, devices_online):
    from app.services import rigs as service

    service.start_calibration("leader")
    assert client.post("/devices/leader/calibrate").status_code == 409

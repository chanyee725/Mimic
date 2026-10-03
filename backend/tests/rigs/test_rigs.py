import yaml


def test_list_rigs(client):
    rows = client.get("/rigs").json()
    assert [r["id"] for r in rows] == ["so101-kit", "so101-bimanual-kit"]
    assert rows[0]["targetHz"] == {"action": 60, "video": 30}


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


def test_devices(client):
    rows = client.get("/devices").json()
    assert len(rows) == 11
    d = client.get("/devices/top").json()
    assert d["streams"][0]["measuredHz"] == 30
    assert client.get("/devices/missing").status_code == 404


def test_calibrate_device(client):
    r = client.post("/devices/follower/calibrate")
    assert r.status_code == 202
    assert r.json()["calibration"]["done"] is False
    # The mock finishes in the background task
    cal = client.get("/devices/follower").json()["calibration"]
    assert cal["done"] is True and cal["note"].startswith("Calibrated")


def test_calibrate_errors(client):
    assert client.post("/devices/missing/calibrate").status_code == 404
    r = client.post("/devices/bi-leader-l/calibrate")
    assert r.status_code == 503 and r.json()["error"]["code"] == "unavailable"


def test_calibrate_twice(client):
    from app.services import rigs as service

    service.start_calibration("leader")
    assert client.post("/devices/leader/calibrate").status_code == 409

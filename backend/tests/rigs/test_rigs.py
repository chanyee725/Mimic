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
    assert "rig_id: so101-kit" in r.text and "feature: observation.images.top" in r.text
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

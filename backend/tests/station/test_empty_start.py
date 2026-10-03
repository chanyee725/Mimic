"""A fresh data folder (rig files only) shows no made-up data anywhere in the core areas."""

from app.core import storage


def test_empty_start(client):
    assert client.get("/tasks").json() == []
    assert client.get("/sessions").json() == []
    assert client.get("/station/current-task").json() == {"taskId": None}
    assert {t["key"]: t["value"] for t in client.get("/station/totals").json()}["episodes"] == "0"
    assert all(d["count"] == 0 for d in client.get("/station/activity").json())
    # Devices are declared by the rig files but nothing is connected or measured
    for d in client.get("/devices").json():
        assert d["health"] == "off" and d["stats"] == [] and d["calibration"]["done"] is False
        assert all(s["measuredHz"] is None for s in d["streams"])
    r = client.post("/capture/start", json={"taskId": "stack-two-blocks", "operator": "OP-01"})
    assert r.status_code == 404  # no such task
    # Loading wrote nothing but the settings part files
    assert sorted(p.name for p in storage.path().iterdir()) == ["rigs", "settings"]

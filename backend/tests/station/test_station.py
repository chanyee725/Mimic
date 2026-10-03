from datetime import date


def test_station(client):
    assert client.get("/station").json() == {
        "id": "Station 01",
        "robot": "SO-101",
        "date": "2026-10-02",
    }


def test_totals(client):
    keys = [t["key"] for t in client.get("/station/totals").json()]
    assert keys == ["episodes", "frames", "hours", "storage", "success"]


def test_activity_default(client):
    rows = client.get("/station/activity").json()
    assert len(rows) == 363
    assert date.fromisoformat(rows[0]["date"]).weekday() == 6  # Sunday
    assert rows[-1] == {"date": "2026-10-02", "count": 17}


def test_activity_weeks(client):
    rows = client.get("/station/activity", params={"weeks": 2}).json()
    assert rows[0]["date"] == "2026-09-20" and rows[-1]["date"] == "2026-10-02"
    assert len(rows) == 13
    assert client.get("/station/activity", params={"weeks": 0}).status_code == 422


def test_warnings(client):
    rows = client.get("/station/warnings").json()
    assert len(rows) == 2 and all(isinstance(w, str) for w in rows)


def test_current_task(client):
    assert client.get("/station/current-task").json() == {"taskId": "stack-two-blocks"}
    r = client.put("/station/current-task", json={"taskId": "open-drawer"})
    assert r.status_code == 200 and r.json() == {"taskId": "open-drawer"}
    assert client.get("/station/current-task").json() == {"taskId": "open-drawer"}


def test_current_task_errors(client):
    r = client.put("/station/current-task", json={"taskId": "missing"})
    assert r.status_code == 404
    assert client.put("/station/current-task", json={}).status_code == 422


def test_current_task_cleared(client):
    assert client.put("/station/current-task", json={"taskId": None}).json() == {"taskId": None}
    client.put("/station/current-task", json={"taskId": "sort-by-color"})
    client.delete("/tasks/sort-by-color")
    assert client.get("/station/current-task").json() == {"taskId": None}

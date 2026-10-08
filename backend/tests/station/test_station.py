"""Station numbers come from the rigs, recordings and the data folder only."""

from datetime import date, datetime
from zoneinfo import ZoneInfo

import pytest

from app.configs.config import config
from app.services import station
from app.services.settings import system
from app.utils import time

NOW = datetime(2026, 10, 3, 15, 0, tzinfo=ZoneInfo("Asia/Seoul"))


@pytest.fixture
def clock():
    time.set_clock(lambda: NOW)
    yield
    time.set_clock(None)


def totals(client):
    return {t["key"]: t["value"] for t in client.get("/station/totals").json()}


def test_station(client, clock):
    # robot = first rig by file name; date = station today
    assert client.get("/station").json() == {
        "id": "Station 01",
        "robot": "SO-101 Bimanual Kit",
        "date": "2026-10-03",
    }


def test_station_robot_follows_current_task(client, task):
    client.put("/station/current-task", json={"taskId": task.id})
    assert client.get("/station").json()["robot"] == "SO-101 Kit"


def test_station_without_rigs(client):
    for p in (config.config_dir / "rigs").glob("*.yaml"):
        p.unlink()
    from app.services import rigs

    rigs.reset()
    assert client.get("/station").json()["robot"] == "No rig"


def test_empty_totals(client):
    rows = client.get("/station/totals").json()
    assert [t["key"] for t in rows] == ["episodes", "frames", "hours", "storage", "success"]
    t = totals(client)
    assert (t["episodes"], t["frames"], t["hours"], t["success"]) == ("0", "0", "0.0 min", "0%")
    assert t["storage"].endswith(" MB")


@pytest.mark.usefixtures("task")
def test_totals_from_real_recordings(client, record):
    a = record()
    b = record(outcome="fail")
    record()  # pending: not part of the success rate
    client.patch(f"/recordings/{a['id']}", json={"review": "accepted"})
    client.patch(f"/recordings/{b['id']}", json={"review": "rejected"})
    recs = client.get("/recordings").json()["items"]
    seconds = sum(r["durationS"] for r in recs)
    t = totals(client)
    assert t["episodes"] == "3"
    assert t["frames"] == f"{sum(round(r['durationS'] * 30) for r in recs):,}"
    assert t["hours"] == f"{seconds / 60:.1f} min"
    assert t["success"] == "50%"  # 1 success out of 2 reviewed
    size = system.dir_size(config.data_dir) / system.MB
    assert t["storage"] == f"{size:.1f} MB"
    assert system.dir_size(config.recordings_dir) > 0


def test_totals_units_switch_at_an_hour_and_a_gb(client, monkeypatch):
    monkeypatch.setattr(system, "dir_size", lambda _path: 1023 * system.MB)
    assert totals(client)["storage"] == "1023.0 MB"
    monkeypatch.setattr(system, "dir_size", lambda _path: system.GB - 1)
    assert totals(client)["storage"] == "1.0 GB"
    monkeypatch.setattr(system, "dir_size", lambda _path: 3 * system.GB // 2)
    assert totals(client)["storage"] == "1.5 GB"
    assert station._duration(90) == "1.5 min"
    assert station._duration(3594) == "59.9 min"
    assert station._duration(3599) == "1.0 h"
    assert station._duration(5400) == "1.5 h"


def test_activity_default(client, clock):
    rows = client.get("/station/activity").json()
    assert len(rows) == 364
    assert date.fromisoformat(rows[0]["date"]).weekday() == 6  # Sunday
    assert rows[-1] == {"date": "2026-10-03", "count": 0, "seconds": 0, "tasks": []}
    assert all(r["count"] == 0 for r in rows)


def test_activity_weeks(client, clock):
    rows = client.get("/station/activity", params={"weeks": 2}).json()
    assert rows[0]["date"] == "2026-09-20" and rows[-1]["date"] == "2026-10-03"
    assert len(rows) == 14
    assert client.get("/station/activity", params={"weeks": 0}).status_code == 422


@pytest.mark.usefixtures("task")
def test_activity_counts_recordings(client, record):
    rec = record()
    record()
    day = datetime.fromisoformat(rec["recordedAt"]).astimezone(ZoneInfo("Asia/Seoul"))
    rows = client.get("/station/activity", params={"weeks": 1}).json()
    [row] = [r for r in rows if r["date"] == day.date().isoformat()]
    assert row["count"] == 2 and row["seconds"] > 0
    [task] = row["tasks"]
    assert task["taskId"] == "stack-two-blocks" and task["count"] == 2 and task["name"]
    assert task["success"] + task["fail"] <= 2 and task["seconds"] == row["seconds"]


def test_warnings_are_real(client, monkeypatch):
    monkeypatch.setattr(system, "disk_used_pct", lambda: 50.0)
    rows = client.get("/station/warnings").json()
    # No drivers: every rig device is reported as not connected
    assert len(rows) == 1 and rows[0].startswith("11 devices not connected: ")
    monkeypatch.setattr(system, "disk_used_pct", lambda: 95.4)
    assert client.get("/station/warnings").json()[1] == "Data disk 95% full"


def test_no_warnings_when_connected(client, devices_online, monkeypatch):
    monkeypatch.setattr(system, "disk_used_pct", lambda: 50.0)
    assert client.get("/station/warnings").json() == []


def test_current_task(client, task):
    assert client.get("/station/current-task").json() == {"taskId": None}
    r = client.put("/station/current-task", json={"taskId": task.id})
    assert r.status_code == 200 and r.json() == {"taskId": task.id}
    assert client.get("/station/current-task").json() == {"taskId": task.id}


def test_current_task_errors(client):
    r = client.put("/station/current-task", json={"taskId": "missing"})
    assert r.status_code == 404
    assert client.put("/station/current-task", json={}).status_code == 422


def test_current_task_cleared(client, task):
    assert client.put("/station/current-task", json={"taskId": None}).json() == {"taskId": None}
    client.put("/station/current-task", json={"taskId": task.id})
    client.delete(f"/tasks/{task.id}")
    assert client.get("/station/current-task").json() == {"taskId": None}

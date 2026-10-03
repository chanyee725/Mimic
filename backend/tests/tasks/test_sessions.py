"""Sessions are derived from recordings (one per task and station day)."""

import pytest

from conftest import add_tasks


def test_no_recordings_no_sessions(client, task):
    assert client.get("/sessions").json() == []


@pytest.mark.usefixtures("task")
def test_sessions_from_recordings(client, record):
    add_tasks("pick-red-cube")
    record()
    record(outcome="fail")
    record(outcome="success")
    other = record("pick-red-cube")
    client.patch(f"/recordings/{other['id']}", json={"review": "accepted"})

    rows = client.get("/sessions").json()
    assert len(rows) == 2
    by_task = {s["taskId"]: s for s in rows}
    stack = by_task["stack-two-blocks"]
    day = stack["date"]
    assert stack == {
        "id": f"stack-two-blocks-{day}",
        "taskId": "stack-two-blocks",
        "operator": None,
        "episodes": 3,
        "accepted": 0,
        "successPct": 66.7,
        "failPct": 33.3,
        "status": "review",
        "date": day,
    }
    pick = by_task["pick-red-cube"]
    assert (pick["episodes"], pick["accepted"], pick["status"]) == (1, 1, "reviewed")

    only = client.get("/sessions", params={"taskId": "pick-red-cube"}).json()
    assert [s["taskId"] for s in only] == ["pick-red-cube"]
    assert client.get("/sessions", params={"taskId": "missing"}).json() == []

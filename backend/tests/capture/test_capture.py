from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from app.services import capture as service
from app.core.events import bus
from app.services import recordings as recordings
from app.utils import time
from tests.conftest import add_tasks, connect_devices

T0 = datetime(2026, 10, 3, 10, 0, 0, tzinfo=ZoneInfo("Asia/Seoul"))
START = {"taskId": "stack-two-blocks"}


class FakeClock:
    def __init__(self) -> None:
        self.t = T0

    def __call__(self) -> datetime:
        return self.t

    def advance(self, s: float) -> None:
        self.t += timedelta(seconds=s)


@pytest.fixture(autouse=True)
def task_and_devices(request):
    add_tasks("stack-two-blocks")
    # Devices are off until a driver connects them; most tests pretend one did
    if "devices_off" not in request.node.name:
        connect_devices()


@pytest.fixture(autouse=True)
def clock():
    service.reset()
    recordings.reset()
    c = FakeClock()
    time.set_clock(c)
    yield c
    time.set_clock(None)
    service.reset()
    recordings.reset()


@pytest.fixture
def events():
    q = bus.subscribe()
    yield q
    bus.unsubscribe(q)


def types(q) -> list[str]:
    out = []
    while not q.empty():
        out.append(q.get_nowait()["type"])
    return out


def record(client, clock, seconds: float = 10) -> None:
    assert client.post("/capture/start", json=START).status_code == 200
    clock.advance(3 + seconds)  # countdown 3 s


def test_idle_state(client):
    st = client.get("/capture/state").json()
    assert st["phase"] == "idle" and st["elapsedS"] == 0 and st["nextEpisode"] == 1


def test_start_countdown_then_recording(client, clock, events):
    st = client.post("/capture/start", json=START).json()
    assert st["phase"] == "countdown" and st["taskId"] == "stack-two-blocks"
    assert "operator" not in st and st["nextEpisode"] == 1
    assert st["episodeId"] == "stack-two-blocks-1" and st["subtaskIndex"] == 0
    assert st["startedAt"] == "2026-10-03T10:00:03.000+09:00"
    assert types(events) == ["capture.state"]
    clock.advance(5)
    st = client.get("/capture/state").json()
    assert st["phase"] == "recording" and st["elapsedS"] == 2


def test_start_errors(client):
    assert client.post("/capture/start", json={**START, "taskId": "nope"}).status_code == 404
    client.post("/capture/start", json=START)
    r = client.post("/capture/start", json=START)
    assert r.status_code == 409 and r.json()["error"]["details"]["phase"] == "countdown"


def test_start_503_when_devices_off(client):
    # The real state today: no drivers, so every device is off
    r = client.post("/capture/start", json=START)
    assert r.status_code == 503 and r.json()["error"]["code"] == "unavailable"
    assert r.json()["error"]["details"]["devices"] == ["leader", "follower", "top", "wrist"]
    assert client.get("/capture/state").json()["phase"] == "idle"


def test_start_503_when_one_device_off(client):
    from app.services import rigs

    rigs.set_device_state("leader", health="off")
    r = client.post("/capture/start", json=START)
    assert r.status_code == 503 and r.json()["error"]["details"]["devices"] == ["leader"]


def test_subtask_and_stop(client, clock):
    record(client, clock, 4)
    st = client.post("/capture/subtask", json={"index": 1}).json()
    assert st["subtaskIndex"] == 1
    assert client.post("/capture/subtask", json={"index": 9}).status_code == 422
    assert client.post("/capture/subtask", json={"index": -1}).status_code == 422
    clock.advance(2)
    st = client.post("/capture/stop").json()
    assert st["phase"] == "review" and st["elapsedS"] == 6
    clock.advance(10)
    assert client.get("/capture/state").json()["elapsedS"] == 6
    assert client.post("/capture/subtask", json={"index": 2}).status_code == 409
    assert client.post("/capture/stop").status_code == 409


def test_actions_need_a_session(client):
    for path in ["/capture/stop", "/capture/rerecord", "/capture/discard"]:
        assert client.post(path).status_code == 409
    assert client.post("/capture/subtask", json={"index": 0}).status_code == 409
    assert client.post("/capture/save", json={"outcome": "success"}).status_code == 409


def test_save_during_countdown_conflicts(client):
    client.post("/capture/start", json=START)
    assert client.post("/capture/save", json={"outcome": "success"}).status_code == 409


def test_auto_stop_at_task_duration(client, clock, events):
    record(client, clock, 45)  # task duration is 30 s
    st = client.get("/capture/state").json()
    assert st["phase"] == "review" and st["elapsedS"] == 30
    assert types(events) == ["capture.state", "capture.state"]


def test_save_creates_recording(client, clock, events):
    record(client, clock, 4)
    client.post("/capture/subtask", json={"index": 1})
    clock.advance(6)
    client.post("/capture/subtask", json={"index": 2})
    clock.advance(2.5)
    client.post("/capture/stop")
    types(events)
    r = client.post("/capture/save", json={"outcome": "partial"})
    assert r.status_code == 201
    rec = r.json()
    assert rec["id"] == "stack-two-blocks-1" and rec["episode"] == 1
    assert rec["file"] == "stack-two-blocks/ep_0001.mcap"
    assert rec["source"] == "capture" and rec["review"] == "pending"
    assert rec["outcome"] == "partial" and rec["rigId"] == "so101-kit"
    assert rec["durationS"] == 12.5 and rec["recordedAt"] == "2026-10-03T10:00:03+09:00"
    assert 0 < rec["sizeMB"] < 1  # joints and labels only, no camera frames yet
    names = [t["name"] for t in rec["topics"]]
    assert names == ["/action", "/observation/state", "/subtask"]
    assert [t["messages"] for t in rec["topics"]] == [750, 750, 3]
    assert rec["subtasks"] == [
        {"name": "reach", "startS": 0, "endS": 4},
        {"name": "grasp", "startS": 4, "endS": 10},
        {"name": "lift", "startS": 10, "endS": 12.5},
    ]
    assert all(c["ok"] for c in rec["checks"])
    assert {"label": "Subtasks", "value": "3 / 4", "ok": True} in rec["checks"]
    assert types(events) == ["recording.created", "capture.state"]
    st = client.get("/capture/state").json()
    assert st["phase"] == "idle" and st["taskId"] == "stack-two-blocks"
    assert st["nextEpisode"] == 2
    assert client.get("/recordings/stack-two-blocks-1").status_code == 200
    assert client.get("/tasks/stack-two-blocks").json()["collected"] == 1


def test_save_while_recording_stops_implicitly(client, clock):
    record(client, clock, 7)
    rec = client.post("/capture/save", json={"outcome": "success"}).json()
    assert rec["durationS"] == 7
    assert client.post("/capture/save", json={"outcome": "bogus"}).status_code == 422


def test_episode_numbers_never_reused(client, clock):
    record(client, clock)
    client.post("/capture/save", json={"outcome": "success"})
    client.delete("/recordings/stack-two-blocks-1")
    record(client, clock)
    assert client.post("/capture/save", json={"outcome": "fail"}).json()["episode"] == 2


def test_rerecord_restarts_same_episode(client, clock):
    record(client, clock, 8)
    client.post("/capture/stop")
    st = client.post("/capture/rerecord").json()
    assert st["phase"] == "countdown" and st["episodeId"] == "stack-two-blocks-1"
    assert st["subtaskIndex"] == 0


def test_discard_returns_to_idle(client, clock):
    record(client, clock, 8)
    st = client.post("/capture/discard").json()
    assert st["phase"] == "idle" and st["nextEpisode"] == 1
    assert client.get("/recordings", params={"taskId": "stack-two-blocks"}).json()["total"] == 0


def test_start_409_once_the_target_is_reached(client, monkeypatch):
    from app.services import tasks

    connect_devices()
    task = tasks.require_task("stack-two-blocks")
    monkeypatch.setattr(task, "collected", task.target_episodes)
    monkeypatch.setattr(service.session, "get_task", lambda _id: task)
    r = client.post("/capture/start", json=START)
    assert r.status_code == 409
    details = r.json()["error"]["details"]
    assert details == {"collected": task.target_episodes, "target": task.target_episodes}
    assert client.get("/capture/state").json()["phase"] == "idle"

import pytest

from app.core.events import bus
from app.services import datasets as service
from app.services import recordings as recordings

NEW = {"taskId": "stack-two-blocks", "repoId": "local/stack_v2", "format": "lerobot_v3"}


@pytest.fixture(autouse=True)
def _reset(monkeypatch):
    monkeypatch.setattr(service, "auto_step_s", None)  # tests drive progress with step()
    service.reset()
    recordings.reset()
    yield
    service.reset()
    recordings.reset()


@pytest.fixture
def events():
    q = bus.subscribe()
    yield q
    bus.unsubscribe(q)


def drain(q) -> list[dict]:
    out = []
    while not q.empty():
        out.append(q.get_nowait())
    return out


def test_preview(client):
    p = client.get("/convert/preview", params={"taskId": "stack-two-blocks"}).json()
    assert p["fps"] == 30 and p["actionHz"] == 60 and p["episodes"] == 10
    keys = [f["key"] for f in p["features"]]
    assert keys == [
        "action",
        "observation.state",
        "observation.images.top",
        "observation.images.wrist",
        "subtask_index",
        "timestamp",
        "frame_index",
        "episode_index",
        "task_index",
    ]
    assert p["features"][0] == {
        "key": "action",
        "dtype": "float32",
        "shape": "[6]",
        "note": "60 Hz → 30 Hz",
    }
    assert p["features"][2]["shape"] == "[480, 640, 3]"
    assert p["estOutputMB"] == pytest.approx(round(p["mcapMB"] * 0.6, 1))
    assert p["frames"] == round(p["lengthS"] * 30)
    assert p["recordedFrom"] < p["recordedTo"]


def test_preview_exclude_and_empty(client):
    p = client.get(
        "/convert/preview",
        params={"taskId": "stack-two-blocks", "exclude": "stack-two-blocks-30,stack-two-blocks-32"},
    ).json()
    assert p["episodes"] == 8
    empty = client.get("/convert/preview", params={"taskId": "wipe-table"}).json()
    assert empty["episodes"] == 0 and empty["recordedFrom"] is None and empty["mcapMB"] == 0


def test_preview_errors(client):
    assert client.get("/convert/preview", params={"taskId": "nope"}).status_code == 404
    assert client.get("/convert/preview").status_code == 422


def test_convert_and_step_to_ready(client, events):
    r = client.post("/convert", json={**NEW, "exclude": ["stack-two-blocks-30"]})
    assert r.status_code == 202
    ds = r.json()
    assert ds["status"] == "converting" and ds["progress"] == 0 and ds["episodeCount"] == 0
    assert ds["kind"] == "lerobot" and ds["format"] == "LeRobot v3.0" and ds["fps"] == 30
    assert ds["hub"] == {"pushed": False, "private": True}
    assert client.get("/datasets").json()[0]["repoId"] == "local/stack_v2"

    service.step("local/stack_v2", 40)
    assert client.get("/datasets/local/stack_v2").json()["progress"] == 40
    service.step(pct=60)
    done = client.get("/datasets/local%2Fstack_v2").json()
    assert done["status"] == "ready" and done.get("progress") is None
    assert done["episodeCount"] == 9 and done["sizeGB"] > 0
    eps = client.get("/datasets/local/stack_v2/episodes").json()
    assert eps["total"] == 9 and eps["items"][0]["source"] == "stack-two-blocks/ep_0032.mcap"
    assert eps["items"][0]["frames"] == round(eps["items"][0]["lengthS"] * 30)
    msgs = drain(events)
    assert [m["type"] for m in msgs] == ["dataset.updated"] * 3
    assert [m["data"].get("progress") for m in msgs] == [0, 40, None]
    assert service.step() == []


def test_convert_errors(client):
    assert (
        client.post("/convert", json={**NEW, "repoId": "local/stack_two_blocks"}).status_code == 409
    )
    assert client.post("/convert", json={**NEW, "taskId": "wipe-table"}).status_code == 422
    assert client.post("/convert", json={**NEW, "taskId": "nope"}).status_code == 404
    assert client.post("/convert", json={**NEW, "repoId": "no-namespace"}).status_code == 422
    assert client.post("/convert", json={**NEW, "format": "lerobot_v2"}).status_code == 422


def test_list_filters(client):
    all_ = client.get("/datasets").json()
    assert len(all_) == 7
    dates = [d["createdAt"] for d in all_]
    assert dates == sorted(dates, reverse=True)
    assert "sizeGB" in all_[0] and "episodes" not in all_[0]
    mcap = client.get("/datasets", params={"kind": "mcap"}).json()
    assert len(mcap) == 3 and all(d["kind"] == "mcap" for d in mcap)
    q = client.get("/datasets", params={"q": "DRAWER"}).json()
    assert [d["repoId"] for d in q] == ["local/open_drawer"]
    assert client.get("/datasets", params={"kind": "zip"}).status_code == 422


def test_get_and_episodes_paging(client):
    ds = client.get("/datasets/local/stack_two_blocks").json()
    assert ds["episodeCount"] == 10
    page = client.get("/datasets/local/stack_two_blocks/episodes", params={"limit": 4}).json()
    assert len(page["items"]) == 4 and page["total"] == 10 and page["nextCursor"] == "4"
    last = client.get(
        "/datasets/local/stack_two_blocks/episodes", params={"limit": 4, "cursor": "8"}
    ).json()
    assert len(last["items"]) == 2 and last["nextCursor"] is None
    assert client.get("/datasets/local/nope").status_code == 404
    assert client.get("/datasets/local/nope/episodes").status_code == 404


def test_thumbnail_not_implemented(client):
    assert client.get("/datasets/local/stack_two_blocks/thumbnail").status_code == 501
    assert client.get("/datasets/local/nope/thumbnail").status_code == 404


def test_push_needs_hf_token(client):
    client.delete("/settings/secrets/hf_token")
    r = client.post("/datasets/raw/sort_by_color/push", json={"private": False})
    assert r.status_code == 424 and r.json()["error"]["code"] == "dependency_failed"


def test_push(client, monkeypatch, events):
    monkeypatch.setattr(service, "hf_token_set", lambda: True)
    r = client.post("/datasets/raw/sort_by_color/push", json={"private": False})
    assert r.status_code == 202 and r.json()["hub"] == {"pushed": True, "private": False}
    assert drain(events)[0]["type"] == "dataset.updated"
    assert client.post("/datasets/local/pick_red_cube/push", json={}).status_code == 409
    assert client.post("/datasets/local/nope/push", json={}).status_code == 404


def test_delete(client, events):
    client.post("/convert", json=NEW)
    drain(events)
    assert client.delete("/datasets/local/stack_v2").status_code == 204
    assert client.get("/datasets/local/stack_v2").status_code == 404
    assert drain(events) and service.step() == []  # running conversion is cancelled
    assert client.delete("/datasets/local/stack_v2").status_code == 404


def test_delete_event(client, events):
    client.delete("/datasets/raw/wipe_table")
    msg = drain(events)[0]
    assert msg["type"] == "dataset.deleted" and msg["data"] == {"repoId": "raw/wipe_table"}

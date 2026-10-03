import pytest

from app.core.events import bus
from app.services import recordings as service

MCAP = b"\x89MCAP0\r\n" + b"\x00" * 64


@pytest.fixture(autouse=True)
def _reset():
    service.reset()
    yield
    service.reset()


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


def test_list_newest_first_with_paging(client):
    r = client.get("/recordings", params={"limit": 5})
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 21 and len(body["items"]) == 5 and body["nextCursor"] == "5"
    dates = [i["recordedAt"] for i in body["items"]]
    assert dates == sorted(dates, reverse=True)
    assert "sizeMB" in body["items"][0]
    nxt = client.get("/recordings", params={"limit": 5, "cursor": body["nextCursor"]}).json()
    assert nxt["items"][0]["id"] not in {i["id"] for i in body["items"]}


def test_list_filters(client):
    body = client.get(
        "/recordings", params={"taskId": "stack-two-blocks", "review": "accepted"}
    ).json()
    assert body["total"] == 10
    assert all(
        i["taskId"] == "stack-two-blocks" and i["review"] == "accepted" for i in body["items"]
    )
    ext = client.get("/recordings", params={"source": "external"}).json()
    assert ext["total"] == 2 and ext["nextCursor"] is None


def test_list_rejects_bad_params(client):
    assert client.get("/recordings", params={"review": "maybe"}).status_code == 422
    assert client.get("/recordings", params={"limit": 501}).status_code == 422


def test_get_and_404(client):
    r = client.get("/recordings/stack-two-blocks-30")
    assert r.status_code == 200 and r.json()["topics"][0]["schema"] == "vla.robot.JointCommand"
    r = client.get("/recordings/nope")
    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"


def test_patch_review(client, events):
    r = client.patch("/recordings/stack-two-blocks-46", json={"review": "accepted"})
    assert r.status_code == 200 and r.json()["review"] == "accepted"
    assert service.get_recording("stack-two-blocks-46").review == "accepted"
    assert [e["type"] for e in drain(events)] == ["recording.updated"]
    assert client.patch("/recordings/nope", json={"review": "accepted"}).status_code == 404
    assert client.patch("/recordings/stack-two-blocks-46", json={"review": "x"}).status_code == 422


def test_delete(client, events):
    assert client.delete("/recordings/stack-two-blocks-30").status_code == 204
    assert client.get("/recordings/stack-two-blocks-30").status_code == 404
    msgs = drain(events)
    assert msgs[0]["type"] == "recording.deleted"
    assert msgs[0]["data"] == {"id": "stack-two-blocks-30"}
    assert client.delete("/recordings/stack-two-blocks-30").status_code == 404


def test_samples_deterministic_and_resampled(client):
    params = {"fromS": 0, "toS": 2, "hz": 10}
    a = client.get("/recordings/stack-two-blocks-30/samples", params=params).json()
    b = client.get("/recordings/stack-two-blocks-30/samples", params=params).json()
    assert a == b
    assert a["joints"][0] == "shoulder_pan" and len(a["joints"]) == 6
    assert len(a["t"]) == 21 and a["t"][-1] == 2
    assert set(a["series"]) == {"action", "state"}
    assert len(a["series"]["action"]) == 6 and len(a["series"]["action"][0]) == 21
    assert all(-90 <= v <= 90 for v in a["series"]["action"][0])
    other = client.get("/recordings/stack-two-blocks-31/samples", params=params).json()
    assert other["series"]["action"] != a["series"]["action"]


def test_samples_clamps_to_duration_and_topics(client):
    r = client.get(
        "/recordings/stack-two-blocks-30/samples", params={"topics": "action", "hz": 1}
    ).json()
    assert r["t"][-1] == 23 and list(r["series"]) == ["action"]
    ext = client.get("/recordings/ext-ros2-0003/samples", params={"hz": 1}).json()
    assert ext["joints"][0] == "joint_1"


def test_samples_errors(client):
    url = "/recordings/stack-two-blocks-30/samples"
    assert client.get(url, params={"topics": "video"}).status_code == 422
    assert client.get(url, params={"fromS": 50}).status_code == 422
    assert client.get(url, params={"hz": 0}).status_code == 422
    assert client.get("/recordings/nope/samples").status_code == 404


def test_file_and_video_not_implemented(client):
    assert client.get("/recordings/stack-two-blocks-30/file").status_code == 501
    r = client.get("/recordings/stack-two-blocks-30/video/top")
    assert r.status_code == 501 and r.json()["error"]["code"] == "not_implemented"
    assert client.get("/recordings/stack-two-blocks-30/video/side").status_code == 404
    assert client.get("/recordings/nope/file").status_code == 404


def test_import(client, events):
    r = client.post(
        "/recordings/import", files={"file": ("My Bag 01.mcap", MCAP, "application/octet-stream")}
    )
    assert r.status_code == 201
    rec = r.json()
    assert rec["id"] == "ext-my-bag-01" and rec["source"] == "external"
    assert rec["file"] == "imports/My_Bag_01.mcap" and rec["review"] == "pending"
    assert rec["checks"][0] == {"label": "Metadata", "value": "missing task / rig", "ok": False}
    assert "taskId" not in rec or rec["taskId"] is None
    assert [e["type"] for e in drain(events)] == ["recording.created"]
    again = client.post("/recordings/import", files={"file": ("My Bag 01.mcap", MCAP)})
    assert again.json()["id"] == "ext-my-bag-01-2"


def test_import_rejects_non_mcap(client):
    assert client.post("/recordings/import", files={"file": ("a.bag", MCAP)}).status_code == 422
    assert client.post("/recordings/import", files={"file": ("a.mcap", b"nope")}).status_code == 422
    assert client.post("/recordings/import").status_code == 422

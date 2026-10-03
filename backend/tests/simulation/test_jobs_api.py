import pytest

from app.core.errors import ApiError
from app.simulation import service
from app.simulation.seed import parse_duration

NEW = {
    "modelId": "m-stack-20k",
    "envId": "clutter-stress",
    "episodes": 5,
    "seedStart": 500,
    "maxSeconds": 30,
    "randomization": "high",
}


def free_gpu(client):
    client.post("/sim/jobs/sim_012/stop")
    client.post("/sim/jobs/sim_013/stop")


def test_parse_duration():
    assert parse_duration("21m") == 1260
    assert parse_duration("1h 5m") == 3900
    assert parse_duration("45s") == 45
    assert parse_duration(None) is None
    with pytest.raises(ValueError):
        parse_duration("soon")


def test_list_jobs_newest_first(client):
    jobs = client.get("/sim/jobs").json()
    assert [j["id"] for j in jobs] == ["sim_013", "sim_012", "sim_011", "sim_010", "sim_009"]
    assert [j["id"] for j in client.get("/sim/jobs", params={"status": "done"}).json()] == [
        "sim_011",
        "sim_010",
    ]
    assert client.get("/sim/jobs", params={"status": "bogus"}).status_code == 422


def test_seeded_job_shape(client):
    job = client.get("/sim/jobs/sim_012").json()
    assert "results" not in job and "elapsed" not in job
    assert job["status"] == "running" and job["startedAt"] == "2026-10-02T14:05:00+09:00"
    assert job["elapsedS"] == 1260 and job["etaS"] == 2160
    assert job["done"] == 37 and job["succeeded"] == 26
    assert sum(job["failureReasons"].values()) == 11
    failed = client.get("/sim/jobs/sim_009").json()
    assert failed["status"] == "failed" and failed["error"].startswith("Isaac Sim could not load")
    assert client.get("/sim/jobs/sim_013").json()["startedAt"] is None


def test_get_job_unknown(client):
    r = client.get("/sim/jobs/sim_999")
    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"


def test_create_queued_when_gpu_busy(client, events):
    r = client.post("/sim/jobs", json=NEW)
    assert r.status_code == 202
    job = r.json()
    assert job["id"] == "sim_014" and job["status"] == "queued"
    assert job["done"] == 0 and job["failureReasons"] == {} and job["startedAt"] is None
    assert job["randomization"] == "high" and job["maxSeconds"] == 30
    assert client.get("/sim/jobs").json()[0]["id"] == "sim_014"
    assert [m["data"]["id"] for m in events() if m["type"] == "sim.updated"] == ["sim_014"]


def test_create_running_when_gpu_free(client):
    free_gpu(client)
    job = client.post("/sim/jobs", json=NEW).json()
    assert job["status"] == "running" and job["startedAt"] and job["elapsedS"] == 0
    assert client.get("/sim/config").json()["gpu"]["busyBy"] == job["id"]


def test_create_defaults(client):
    job = client.post("/sim/jobs", json={"modelId": "m-stack-20k", "envId": "clutter-stress"})
    assert job.status_code == 202
    assert job.json()["episodes"] == 50 and job.json()["randomization"] == "low"


def test_create_incompatible(client):
    r = client.post("/sim/jobs", json={**NEW, "envId": "top-only-demo"})
    assert r.status_code == 422
    err = r.json()["error"]
    assert err["code"] == "validation_error"
    assert err["details"]["issues"] == [{"level": "error", "text": "Missing camera wrist"}]
    r = client.post("/sim/jobs", json={**NEW, "envId": "pour-into-cup"})
    assert r.status_code == 422 and r.json()["error"]["details"]["issues"][0]["level"] == "error"


def test_create_warning_only_is_allowed(client):
    assert client.post("/sim/jobs", json={**NEW, "envId": "sort-by-color"}).status_code == 202


def test_create_unknown_ids(client):
    r = client.post("/sim/jobs", json={**NEW, "modelId": "m-nope"})
    assert r.status_code == 422 and "m-nope" in r.json()["error"]["message"]
    r = client.post("/sim/jobs", json={**NEW, "envId": "nope"})
    assert r.status_code == 422 and "nope" in r.json()["error"]["message"]


def test_create_bad_body(client):
    r = client.post("/sim/jobs", json={**NEW, "episodes": 0})
    assert r.status_code == 422 and r.json()["error"]["details"]["errors"]
    assert client.post("/sim/jobs", json={**NEW, "randomization": "max"}).status_code == 422


def test_stop(client, events):
    r = client.post("/sim/jobs/sim_012/stop")
    assert r.status_code == 200 and r.json()["status"] == "stopped" and r.json()["etaS"] is None
    promoted = client.get("/sim/jobs/sim_013").json()
    assert promoted["status"] == "running" and promoted["startedAt"]
    assert [m["data"]["id"] for m in events() if m["type"] == "sim.updated"] == [
        "sim_012",
        "sim_013",
    ]


def test_stop_queued(client):
    assert client.post("/sim/jobs/sim_013/stop").json()["status"] == "stopped"
    assert client.get("/sim/jobs/sim_012").json()["status"] == "running"


def test_stop_inactive_conflict(client):
    r = client.post("/sim/jobs/sim_011/stop")
    assert r.status_code == 409
    assert (
        r.json()["error"]["code"] == "conflict" and r.json()["error"]["details"]["status"] == "done"
    )
    assert client.post("/sim/jobs/sim_999/stop").status_code == 404


def test_episodes_paging(client):
    page = client.get("/sim/jobs/sim_011/episodes", params={"limit": 20}).json()
    assert page["total"] == 50 and len(page["items"]) == 20 and page["nextCursor"] == "20"
    assert [e["index"] for e in page["items"]] == list(range(20))
    last = client.get(
        "/sim/jobs/sim_011/episodes", params={"limit": 20, "cursor": page["nextCursor"] + "0"}
    )
    assert last.json()["items"] == []
    tail = client.get("/sim/jobs/sim_011/episodes", params={"limit": 20, "cursor": "40"}).json()
    assert len(tail["items"]) == 10 and tail["nextCursor"] is None


def test_episodes_filter(client):
    ok = client.get("/sim/jobs/sim_011/episodes", params={"result": "success"}).json()
    bad = client.get("/sim/jobs/sim_011/episodes", params={"result": "fail"}).json()
    assert ok["total"] == 41 and all(e["success"] for e in ok["items"])
    assert bad["total"] == 9 and all(not e["success"] and e["reason"] for e in bad["items"])
    assert "reason" not in ok["items"][0] or ok["items"][0]["reason"] is None


def test_episodes_errors(client):
    assert client.get("/sim/jobs/sim_999/episodes").status_code == 404
    assert client.get("/sim/jobs/sim_011/episodes", params={"result": "x"}).status_code == 422
    assert client.get("/sim/jobs/sim_011/episodes", params={"limit": 501}).status_code == 422
    assert client.get("/sim/jobs/sim_013/episodes").json() == {
        "items": [],
        "nextCursor": None,
        "total": 0,
    }


def test_episode_video(client):
    r = client.get("/sim/jobs/sim_011/episodes/3/video/top")
    assert r.status_code == 501 and r.json()["error"]["code"] == "not_implemented"
    assert client.get("/sim/jobs/sim_011/episodes/50/video/top").status_code == 404
    assert client.get("/sim/jobs/sim_011/episodes/3/video/side").status_code == 404
    assert client.get("/sim/jobs/sim_999/episodes/0/video/top").status_code == 404


def test_advance_appends_episodes(client, events):
    job = service.advance("sim_012", 3)
    assert job.done == 40
    eps = client.get("/sim/jobs/sim_012/episodes", params={"cursor": "37"}).json()["items"]
    assert [(e["index"], e["seed"]) for e in eps] == [(37, 1037), (38, 1038), (39, 1039)]
    msgs = events()
    assert [m["data"]["episode"]["index"] for m in msgs if m["type"] == "sim.episode"] == [
        37,
        38,
        39,
    ]
    assert msgs[0]["data"]["jobId"] == "sim_012"
    assert msgs[-1]["type"] == "sim.updated" and msgs[-1]["data"]["done"] == 40
    served = client.get("/sim/jobs/sim_012").json()
    assert served["succeeded"] + sum(served["failureReasons"].values()) == 40
    assert served["etaS"] > 0 and served["elapsedS"] > 1260


def test_advance_is_deterministic(client):
    free_gpu(client)
    a = client.post("/sim/jobs", json=NEW).json()["id"]
    service.advance(a, 5)
    first = client.get(f"/sim/jobs/{a}/episodes").json()["items"]
    service.reset()
    free_gpu(client)
    b = client.post("/sim/jobs", json=NEW).json()["id"]
    service.advance(b, 5)
    assert client.get(f"/sim/jobs/{b}/episodes").json()["items"] == first
    assert all(e["seconds"] <= NEW["maxSeconds"] for e in first)


def test_advance_finishes_and_promotes(client, events):
    job = service.advance("sim_012", 1000)
    assert job.status == "done" and job.done == 100 and job.eta_s is None
    assert client.get("/sim/jobs/sim_013").json()["status"] == "running"
    updated = [m["data"] for m in events() if m["type"] == "sim.updated"]
    assert [(d["id"], d["status"]) for d in updated] == [
        ("sim_012", "done"),
        ("sim_013", "running"),
    ]


def test_advance_requires_running():
    with pytest.raises(ApiError) as e:
        service.advance("sim_013", 1)
    assert e.value.status == 409
    with pytest.raises(ApiError) as e:
        service.advance("sim_999", 1)
    assert e.value.status == 404

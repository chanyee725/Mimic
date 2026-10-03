from datetime import timedelta

from app.utils import time as clock
from app.services import evaluate as service
from app.services import models

BODY = {"modelId": "m-stack-20k", "instruction": "stack the blocks", "limitS": 60, "record": False}


def _start(client, **kw):
    r = client.post("/evaluate/runs", json={**BODY, **kw})
    assert r.status_code == 201, r.text
    return r.json()


def test_run_lifecycle_records_success(client):
    run = _start(client)
    assert run["state"] == "running"
    assert run["limitS"] == 60
    r = client.post(f"/evaluate/runs/{run['id']}/stop")
    assert r.json()["state"] == "judging"
    r = client.post(f"/evaluate/runs/{run['id']}/result", json={"result": "success"})
    assert r.json() == {**r.json(), "state": "done", "result": "success"}
    ev = models.get_model("m-stack-20k").evals[-1]
    assert (ev.instruction, ev.trials, ev.success) == ("stack the blocks", 1, 1)


def test_trials_accumulate_in_one_eval(client):
    for result in ("success", "fail", "discard", "fail"):
        run = _start(client)
        client.post(f"/evaluate/runs/{run['id']}/stop")
        client.post(f"/evaluate/runs/{run['id']}/result", json={"result": result})
    evals = models.get_model("m-stack-20k").evals
    assert len(evals) == 2  # seed eval + this session
    assert (evals[-1].trials, evals[-1].success) == (3, 1)
    runs = client.get("/evaluate/runs", params={"modelId": "m-stack-20k"}).json()
    assert len(runs) == 4
    assert runs[2].get("result") is None
    assert client.get("/evaluate/runs", params={"modelId": "m-open-drawer-20k"}).json() == []


def test_only_one_active_run(client):
    run = _start(client)
    r = client.post("/evaluate/runs", json=BODY)
    assert r.status_code == 409
    assert r.json()["error"]["details"]["runId"] == run["id"]
    client.post(f"/evaluate/runs/{run['id']}/stop")
    # Judging still blocks a new run
    assert client.post("/evaluate/runs", json=BODY).status_code == 409


def test_auto_judging_at_limit(client, monkeypatch):
    run = _start(client, limitS=5)
    later = clock.now() + timedelta(seconds=10)
    monkeypatch.setattr(service, "now", lambda: later)
    r = client.get(f"/evaluate/runs/{run['id']}").json()
    assert r["state"] == "judging"
    assert r["elapsedS"] == 5


def test_invalid_transitions(client):
    run = _start(client)
    assert (
        client.post(f"/evaluate/runs/{run['id']}/result", json={"result": "fail"}).status_code
        == 409
    )
    client.post(f"/evaluate/runs/{run['id']}/stop")
    assert client.post(f"/evaluate/runs/{run['id']}/stop").status_code == 409
    r = client.post(f"/evaluate/runs/{run['id']}/result", json={"result": "maybe"})
    assert r.status_code == 422


def test_start_errors(client):
    assert client.post("/evaluate/runs", json={**BODY, "modelId": "nope"}).status_code == 404
    assert client.post("/evaluate/runs", json={**BODY, "instruction": "  "}).status_code == 422
    assert client.post("/evaluate/runs", json={**BODY, "limitS": 0}).status_code == 422
    assert client.get("/evaluate/runs/nope").status_code == 404
    assert client.post("/evaluate/runs/nope/stop").status_code == 404

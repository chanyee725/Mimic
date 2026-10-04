"""Evaluate: runs need the robot, which is not connected yet."""

from app.services import evaluate
from tests.support import write_model

BODY = {"modelId": "m-a", "instruction": "stack the blocks", "limitS": 30}


def test_starts_empty(client):
    assert client.get("/evaluate/runs").json() == []
    assert client.get("/evaluate/runs/run_001").status_code == 404


def test_start_needs_the_robot(client):
    write_model("m-a")
    r = client.post("/evaluate/runs", json=BODY)
    assert r.status_code == 503
    assert r.json()["error"]["message"] == "Robot is not connected"
    assert r.json()["error"]["code"] == "unavailable"
    assert client.get("/evaluate/runs").json() == []


def test_start_errors(client):
    assert client.post("/evaluate/runs", json=BODY).status_code == 404
    write_model("m-a")
    assert client.post("/evaluate/runs", json={**BODY, "instruction": "  "}).status_code == 422
    assert client.post("/evaluate/runs", json={**BODY, "limitS": 0}).status_code == 422


def test_unknown_run_transitions(client):
    assert client.post("/evaluate/runs/run_001/stop").status_code == 404
    r = client.post("/evaluate/runs/run_001/result", json={"result": "success"})
    assert r.status_code == 404
    assert evaluate.list_runs() == []

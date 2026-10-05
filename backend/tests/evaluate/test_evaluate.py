"""Evaluate: a fake policy drives the fake follower; cameras come from the fake driver."""

import time

import pytest

from app.services import evaluate, models
from app.services import rigs
from app.services.evaluate import policy as policies
from app.services.rigs import driver, ports
from tests.support import JOINTS, FakeDriver, write_model

BODY = {"modelId": "m-a", "instruction": "stack the blocks"}


class FakePolicy:
    """Asks every joint to go to `target`; set `fail` to raise on the next step."""

    def __init__(self):
        self.target = 2.0
        self.fail: str | None = None
        self.calls = 0
        self.tasks: list[str] = []
        self.cameras: set[str] = set()

    def reset(self):
        self.calls = 0

    def act(self, images, state, task):
        if self.fail:
            raise RuntimeError(self.fail)
        self.calls += 1
        self.tasks.append(task)
        self.cameras |= set(images)
        return [self.target] * len(state)


@pytest.fixture
def fake(tmp_path, monkeypatch):
    d = FakeDriver(tmp_path / "calibration")
    d.calibration_dir.mkdir()
    d.frame_count = None  # cameras keep sending
    monkeypatch.setattr(ports, "exists", lambda p: True)
    driver.use(d)
    rigs.reset()
    yield d
    evaluate.reset()
    driver.use(None)
    rigs.reset()


@pytest.fixture
def policy(monkeypatch):
    p = FakePolicy()
    monkeypatch.setattr(policies, "load", lambda model_id, path: p)
    return p


@pytest.fixture
def model(task):
    write_model("m-a")


def wait_state(client, run_id: str, *states: str, timeout: float = 5) -> dict:
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        run = client.get(f"/evaluate/runs/{run_id}").json()
        if run["state"] in states:
            return run
        time.sleep(0.02)
    raise AssertionError(f"{run_id} is {run['state']}")


def test_starts_empty(client):
    assert client.get("/evaluate/runs").json() == []
    assert client.get("/evaluate/runs/run_001").status_code == 404


def test_start_needs_device_access(client, model):
    r = client.post("/evaluate/runs", json=BODY)
    assert r.status_code == 503
    assert "Device access is disabled" in r.json()["error"]["message"]
    assert client.get("/evaluate/runs").json() == []


def test_start_errors(client, task):
    assert client.post("/evaluate/runs", json=BODY).status_code == 404
    write_model("m-a")
    assert client.post("/evaluate/runs", json={**BODY, "instruction": "  "}).status_code == 422
    assert client.post("/evaluate/runs", json={**BODY, "limitS": 0}).status_code == 422
    r = client.post("/evaluate/runs", json={**BODY, "record": True})
    assert r.status_code == 422 and r.json()["error"]["message"] == evaluate.RECORD_UNAVAILABLE


def test_run_stop_judge(client, fake, policy, model):
    r = client.post("/evaluate/runs", json=BODY)
    assert r.status_code == 201, r.text
    run = r.json()
    assert run["id"] == "run_001" and run["state"] in ("loading", "running")
    wait_state(client, "run_001", "running")
    time.sleep(0.3)
    s = client.get("/evaluate/runs/run_001/samples").json()
    assert s["joints"] == JOINTS and len(s["t"]) > 3 and s["seq"] >= 3
    assert s["action"][-1] == [2.0] * 6 and s["state"][-1] == [2.0] * 6
    assert policy.tasks[0] == "stack the blocks" and policy.cameras == {"top", "wrist"}
    newer = client.get("/evaluate/runs/run_001/samples", params={"after": s["seq"]}).json()
    assert all(t > s["t"][-1] for t in newer["t"])
    # Only one run at a time, and no capture while it runs
    assert client.post("/evaluate/runs", json=BODY).status_code == 409

    stopped = client.post("/evaluate/runs/run_001/stop").json()
    assert stopped["state"] == "judging" and stopped["elapsedS"] > 0
    sent = len(fake.robot.sent)
    time.sleep(0.1)
    assert len(fake.robot.sent) == sent and not fake.robot.closed  # holds the pose

    done = client.post("/evaluate/runs/run_001/result", json={"result": "success"}).json()
    assert done["state"] == "done" and done["result"] == "success"
    assert fake.robot.closed
    assert models.get_model("m-a").evals[-1].success == 1


def test_actions_are_rate_limited(client, fake, policy, model):
    policy.target = 100.0
    client.post("/evaluate/runs", json=BODY)
    wait_state(client, "run_001", "running")
    time.sleep(0.2)
    client.post("/evaluate/runs/run_001/stop")
    steps = [a["shoulder_pan"] for a in fake.robot.sent]
    assert steps[0] == evaluate.MAX_STEP
    assert all(b - a <= evaluate.MAX_STEP + 1e-9 for a, b in zip(steps, steps[1:]))
    assert steps[-1] < 100


def test_time_limit_moves_to_judging(client, fake, policy, model):
    client.post("/evaluate/runs", json={**BODY, "limitS": 0.3})
    run = wait_state(client, "run_001", "judging")
    assert run["elapsedS"] == 0.3 and run["error"] is None


def test_no_limit_runs_until_the_cap(client, fake, policy, model, monkeypatch):
    from app.services.evaluate import runs

    monkeypatch.setattr(runs, "MAX_RUN_S", 0.3)
    r = client.post("/evaluate/runs", json=BODY).json()
    assert r["limitS"] is None
    assert wait_state(client, "run_001", "judging")["elapsedS"] == 0.3


def test_policy_error_ends_the_run(client, fake, policy, model):
    policy.fail = "CUDA out of memory"
    client.post("/evaluate/runs", json=BODY)
    run = wait_state(client, "run_001", "judging")
    assert run["error"] == "CUDA out of memory"
    done = client.post("/evaluate/runs/run_001/result", json={"result": "success"}).json()
    assert done["result"] is None  # a broken run does not count
    assert models.get_model("m-a").evals == []


def test_teleop_blocks_a_run(client, fake, policy, model):
    assert client.post("/rigs/so101-kit/teleop").status_code == 201
    r = client.post("/evaluate/runs", json=BODY)
    assert r.status_code == 409 and "Teleop" in r.json()["error"]["message"]
    client.delete("/rigs/so101-kit/teleop")


def test_unknown_run_transitions(client):
    assert client.post("/evaluate/runs/run_001/stop").status_code == 404
    r = client.post("/evaluate/runs/run_001/result", json={"result": "success"})
    assert r.status_code == 404
    assert client.get("/evaluate/runs/run_001/samples").status_code == 404
    assert evaluate.list_runs() == []

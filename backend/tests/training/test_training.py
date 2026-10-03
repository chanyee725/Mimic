import pytest

from app.models import service as models
from app.training import service
from app.training.metrics import _rng, _seed_of

LOCAL = {"dataset": "local/open_drawer", "compute": "local", "gpu": "cuda:0", "overrides": {}}
RUNPOD = {
    "dataset": "local/stack_two_blocks",
    "compute": "runpod",
    "gpu": "A100 PCIe",
    "overrides": {"steps": 20000, "batch_size": 64},
    "runpod": {"cloud": "community", "pricing": "spot", "gpuCount": 2, "budget": 3},
}


@pytest.mark.parametrize(
    "text,seconds", [("2h 08m", 7680), ("58m", 3480), ("15h 49m", 56940), (None, None)]
)
def test_parse_duration(text, seconds):
    assert service.parse_duration(text) == seconds


def test_rng_matches_web():
    # Reference values from the web mulberry32 (rng(seedOf("job_036")))
    assert _seed_of("job_036") == 2172098858
    rand = _rng(_seed_of("job_036"))
    assert [rand() for _ in range(3)] == [
        0.9922949697356671,
        0.9047266284469515,
        0.4730755491182208,
    ]


def test_config(client):
    cfg = client.get("/training/config").json()
    assert cfg["policyBase"] == "lerobot/smolvla_base"
    assert cfg["localGpus"][0]["busyBy"] == "job_037"
    assert cfg["trainableDatasets"] == ["local/stack_two_blocks", "local/open_drawer"]
    assert cfg["runpod"]["defaults"]["diskGB"] == 50
    assert cfg["runpod"]["gpus"][0]["vramGB"] == 16
    assert cfg["runpod"]["priceFactor"]["pricing"]["spot"] == 0.5
    keys = [p["key"] for g in cfg["paramGroups"] for p in g["params"]]
    assert "policy.optimizer_lr" in keys and len(keys) == 18


def test_jobs_list_and_get(client):
    jobs = client.get("/training/jobs").json()
    assert jobs[0]["id"] == "job_038"  # queued (not started) first
    assert {j["id"] for j in jobs} >= {"job_033", "job_037"}
    assert [j["id"] for j in client.get("/training/jobs?status=failed").json()] == ["job_034"]
    j = client.get("/training/jobs/job_036").json()
    assert (j["elapsedS"], j["etaS"], j["overrides"]) == (7680, 4320, {})
    assert j["stepsPerS"] == round(7200 / 4320, 3)
    assert j["costUsd"] == round(1.89 * 7680 / 3600, 2)
    assert j["checkpoints"][0]["sizeMb"] == 1850
    idle = client.get("/training/jobs/job_035").json()["podState"]
    assert idle["idleForS"] == 56940 and idle["since"].startswith("2026-10-01T23:11")
    assert client.get("/training/jobs/nope").status_code == 404
    assert client.get("/training/jobs?status=paused").status_code == 422


def test_create_local_queued_behind_busy_gpu(client):
    r = client.post("/training/jobs", json={**LOCAL, "overrides": {"batch_size": 16}})
    assert r.status_code == 202
    job = r.json()
    assert (job["id"], job["status"], job["gpu"]) == ("job_039", "queued", "RTX 4090")
    assert (job["total"], job["batch"], job["taskId"]) == (100000, 16, "open-drawer")
    # Stopping the running local job starts the queued one
    client.post("/training/jobs/job_037/stop")
    assert client.get("/training/jobs/job_039").json()["status"] == "running"
    assert client.get("/training/config").json()["localGpus"][0]["busyBy"] == "job_039"


def test_create_local_running_when_gpu_free(client):
    client.post("/training/jobs/job_037/stop")
    job = client.post("/training/jobs", json={**LOCAL, "gpu": "RTX 4090"}).json()
    assert job["status"] == "running" and job["elapsedS"] == 0 and job["startedAt"]


def test_create_runpod(client):
    job = client.post("/training/jobs", json=RUNPOD).json()
    assert job["status"] == "running"
    assert job["pricePerHr"] == round(1.64 * 2 * 0.8 * 0.5, 4)
    assert job["pod"] == "pod-pcie-039"
    assert job["podState"]["state"] == "running" and job["podState"]["autoTerminate"]
    assert job["costUsd"] == 0


@pytest.mark.parametrize(
    "patch,loc",
    [
        ({"dataset": "local/pick_red_cube"}, "dataset"),
        ({"dataset": "raw/stack_two_blocks"}, "dataset"),
        ({"overrides": {"nope": 1}}, "nope"),
        ({"overrides": {"steps": "many"}}, "steps"),
        ({"overrides": {"steps": 0}}, "steps"),
        ({"overrides": {"policy.use_amp": 1}}, "policy.use_amp"),
        ({"overrides": {"policy.optimizer_lr": "fast"}}, "policy.optimizer_lr"),
        ({"gpu": "GTX 1080"}, "gpu"),
        ({"runpod": {"region": "MARS-1"}}, "region"),
        ({"runpod": {"volume": "nope"}}, "volume"),
        ({"gpu": "A40", "runpod": {"cloud": "community"}}, "cloud"),
    ],
)
def test_create_validation(client, patch, loc):
    r = client.post("/training/jobs", json={**RUNPOD, **patch})
    assert r.status_code == 422, r.text
    assert loc in r.json()["error"]["details"]["errors"][0]["loc"]


def test_create_runpod_errors(client, monkeypatch):
    r = client.post("/training/jobs", json={**RUNPOD, "gpu": "B200", "runpod": None})
    assert r.status_code == 409
    monkeypatch.setattr(service, "_secret_set", lambda name: name != "runpod_api_key")
    r = client.post("/training/jobs", json=RUNPOD)
    assert r.status_code == 424
    # Local jobs do not need the key
    assert client.post("/training/jobs", json=LOCAL).status_code == 202


def test_stop(client):
    job = client.post("/training/jobs/job_036/stop").json()
    assert job["status"] == "stopped"
    assert job["checkpoints"][-1]["step"] == 12800
    assert job["podState"]["state"] == "terminated"
    r = client.post("/training/jobs/job_036/stop")
    assert r.status_code == 409 and r.json()["error"]["code"] == "conflict"
    assert client.post("/training/jobs/job_038/stop").json()["status"] == "stopped"
    assert client.post("/training/jobs/nope/stop").status_code == 404


def test_terminate_pod(client):
    job = client.post("/training/jobs/job_035/pod/terminate").json()
    assert job["podState"]["state"] == "terminated"
    assert client.post("/training/jobs/job_035/pod/terminate").status_code == 409
    assert client.post("/training/jobs/job_036/pod/terminate").status_code == 409  # active
    assert client.post("/training/jobs/job_037/pod/terminate").status_code == 409  # local


def test_metrics(client):
    m = client.get("/training/jobs/job_036/metrics", params={"maxPoints": 100}).json()
    assert (m["fromStep"], m["toStep"], m["every"]) == (0, 12800, 128)
    assert set(m["series"]) == {
        "loss_raw",
        "loss",
        "grad_norm",
        "lr",
        "update_s",
        "data_s",
        "gpu_util",
        "gpu_mem",
    }
    assert len(m["series"]["loss"]) == 100
    assert m["series"]["loss"][0] > m["series"]["loss"][-1]
    assert 38 < m["series"]["gpu_mem"][-1] < 38.5  # A100 profile
    # Deterministic per job, and fromStep trims the start
    again = client.get("/training/jobs/job_036/metrics", params={"maxPoints": 100}).json()
    assert again == m
    tail = client.get("/training/jobs/job_036/metrics", params={"fromStep": 12700}).json()
    assert (tail["every"], len(tail["series"]["lr"])) == (1, 100)
    assert client.get("/training/jobs/job_038/metrics").json()["toStep"] == 0
    assert client.get("/training/jobs/job_036/metrics?maxPoints=0").status_code == 422
    assert client.get("/training/jobs/nope/metrics").status_code == 404


def test_command(client):
    cmd = client.get("/training/jobs/job_037/command").json()["command"]
    assert cmd == (
        "lerobot-train --policy.path=lerobot/smolvla_base --dataset.repo_id=local/open_drawer"
        " --policy.device=cuda --steps=20000 --batch_size=32"
    )
    assert client.get("/training/jobs/nope/command").status_code == 404


def test_command_preview(client):
    body = {**RUNPOD, "overrides": {"steps": 100000, "policy.use_amp": True, "seed": 7}}
    p = client.post("/training/command-preview", json=body).json()
    assert p["command"].endswith("--policy.device=cuda --seed=7 --policy.use_amp=true")
    rate = 1.64 * 2 * 0.8 * 0.5
    assert p["ratePerHr"] == round(rate, 4)
    assert p["capHours"] == round(3 / rate, 2)
    assert p["maxCostUsd"] == 3
    local = client.post("/training/command-preview", json=LOCAL).json()
    assert local.get("ratePerHr") is None
    no_cap = {**RUNPOD, "runpod": {"maxHours": 0}}
    assert client.post("/training/command-preview", json=no_cap).json().get("capHours") is None
    bad = client.post("/training/command-preview", json={**LOCAL, "overrides": {"x": 1}})
    assert bad.status_code == 422


def test_checkpoint_save_creates_model(client):
    r = client.post("/training/jobs/job_035/checkpoints/20000/save", json={"name": "drawer v3"})
    assert r.status_code == 201
    m = r.json()
    assert (m["id"], m["step"], m["taskId"], m["jobId"]) == (
        "m-job_035-020000",
        20000,
        "open-drawer",
        "job_035",
    )
    assert 0 < m["loss"] < 0.2
    assert models.get_model(m["id"]).name == "drawer v3"
    assert client.get(f"/models/{m['id']}").status_code == 200
    again = client.post("/training/jobs/job_035/checkpoints/20000/save", json={"name": "x"})
    assert again.status_code == 409
    missing = client.post("/training/jobs/job_035/checkpoints/123/save", json={"name": "x"})
    assert missing.status_code == 404
    empty = client.post("/training/jobs/job_035/checkpoints/20000/save", json={"name": ""})
    assert empty.status_code == 422


def test_checkpoint_push_and_download(client, monkeypatch):
    r = client.post("/training/jobs/job_035/checkpoints/5000/push", json={})
    assert r.status_code == 202
    assert r.json() == {"repo": "vla-lab/smolvla_open_drawer"}
    r = client.post("/training/jobs/job_035/checkpoints/5000/push", json={"repo": "vla-lab/x"})
    assert r.json() == {"repo": "vla-lab/x"}
    assert client.post("/training/jobs/job_035/checkpoints/1/push", json={}).status_code == 404
    monkeypatch.setattr(service, "_secret_set", lambda name: False)
    assert client.post("/training/jobs/job_035/checkpoints/5000/push").status_code == 424
    assert client.get("/training/jobs/job_035/checkpoints/5000/download").status_code == 501
    assert client.get("/training/jobs/job_035/checkpoints/1/download").status_code == 404

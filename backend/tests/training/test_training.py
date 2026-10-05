"""Training: options, command preview and local jobs run by a fake lerobot-train."""

import sys
import time
from pathlib import Path

import pytest

from app.configs.config import config
from app.core.events import bus
from app.services import models, training
from app.services.training import local
from app.utils import gpu
from tests.support import write_recording

FAKE = Path(__file__).with_name("fake_trainer.py")

RTX = (gpu.Gpu(id="cuda:0", name="NVIDIA GeForce RTX 4090", vram="24 GB"),)
LOCAL = {"dataset": "local/stack", "compute": "local", "gpu": "cuda:0", "overrides": {}}
RUNPOD = {
    "dataset": "local/stack",
    "compute": "runpod",
    "gpu": "A100 PCIe",
    "overrides": {"steps": 20000, "batch_size": 64},
    "runpod": {"cloud": "community", "pricing": "spot", "gpuCount": 2, "budget": 3},
}


@pytest.fixture(autouse=True)
def gpus(monkeypatch):
    """One detected RTX 4090 unless a test changes it."""
    monkeypatch.setattr(gpu, "detect", lambda: RTX)


@pytest.fixture(autouse=True)
def trainer(monkeypatch):
    """lerobot-train is the fake script; no GPU utilization queries."""
    monkeypatch.setattr(local, "trainer_cmd", lambda: [sys.executable, str(FAKE)])
    monkeypatch.setattr(local, "PROCESS_MARK", b"fake_trainer")
    monkeypatch.setattr(local, "TICK_S", 0.05)
    monkeypatch.setattr(gpu, "utilization", lambda index: 50.0)
    yield
    local.reset()


def wait_for(job_id: str, *statuses: str, timeout: float = 15) -> dict:
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        job = training.get_job(job_id)
        if job.status in statuses:
            return job.model_dump(mode="json", by_alias=True)
        time.sleep(0.05)
    raise AssertionError(f"{job_id} is {training.get_job(job_id).status}, not {statuses}")


@pytest.fixture
def dataset(client, task):
    from app.services import datasets

    write_recording(1)
    body = {"taskId": "stack-two-blocks", "repoId": "local/stack"}
    assert client.post("/convert", json=body).status_code == 202
    assert datasets.wait("local/stack").status == "ready"


def test_gpu_parse():
    out = "NVIDIA GeForce RTX 4090, 24564\nNVIDIA RTX A4000, 16376\nbad line\n"
    assert gpu.parse(out) == [
        gpu.Gpu(id="cuda:0", name="NVIDIA GeForce RTX 4090", vram="24 GB"),
        gpu.Gpu(id="cuda:1", name="NVIDIA RTX A4000", vram="16 GB"),
    ]


def test_config(client, dataset):
    cfg = client.get("/training/config").json()
    assert cfg["policyBase"] == "lerobot/smolvla_base"
    assert cfg["localGpus"] == [
        {"id": "cuda:0", "name": "NVIDIA GeForce RTX 4090", "vram": "24 GB", "busyBy": None}
    ]
    assert cfg["trainableDatasets"] == ["local/stack"]
    assert cfg["runpod"]["defaults"]["diskGB"] == 50
    assert cfg["runpod"]["gpus"][0]["vramGB"] == 16
    keys = [p["key"] for g in cfg["paramGroups"] for p in g["params"]]
    assert "policy.optimizer_lr" in keys and len(keys) == 17


def test_config_without_gpu(client, monkeypatch):
    monkeypatch.setattr(gpu, "detect", lambda: ())
    cfg = client.get("/training/config").json()
    assert cfg["localGpus"] == [] and cfg["trainableDatasets"] == []


def test_jobs_empty(client):
    assert client.get("/training/jobs").json() == []
    assert client.get("/training/jobs", params={"status": "running"}).json() == []
    for path in ("", "/command", "/metrics"):
        assert client.get(f"/training/jobs/job_001{path}").status_code == 404
    assert client.post("/training/jobs/job_001/stop").status_code == 404
    assert client.post("/training/jobs/job_001/pod/terminate").status_code == 404
    assert client.get("/training/jobs/job_001/checkpoints/1/download").status_code == 404
    r = client.post("/training/jobs/job_001/checkpoints/1/save", json={"name": "x"})
    assert r.status_code == 404


SMALL = {**LOCAL, "overrides": {"steps": 20, "log_freq": 5, "save_freq": 10}}


def test_local_job_runs_to_done(client, dataset):
    q = bus.subscribe()
    r = client.post("/training/jobs", json=SMALL)
    assert r.status_code == 202, r.text
    job = r.json()
    assert job["id"] == "job_001" and job["status"] == "running" and job["total"] == 20
    assert job["taskId"] == "stack-two-blocks" and job["gpu"] == "NVIDIA GeForce RTX 4090"
    done = wait_for("job_001", "done", "failed")
    assert done["status"] == "done", done["error"]
    assert done["step"] == 20 and [c["step"] for c in done["checkpoints"]] == [10, 20]

    m = client.get("/training/jobs/job_001/metrics").json()
    assert m["every"] == 5 and m["toStep"] == 20
    assert m["series"]["loss_raw"] == [0.2, 0.1, 0.067, 0.05]
    assert m["series"]["gpu_util"] == [50.0] * 4 and m["series"]["gpu_mem"][0] == 2.12
    assert m["series"]["loss"][0] == 0.2 and m["series"]["loss"][1] < 0.2
    coarse = client.get("/training/jobs/job_001/metrics", params={"maxPoints": 2}).json()
    assert coarse["every"] == 10 and coarse["series"]["loss_raw"] == [0.15, 0.0585]

    types = []
    while not q.empty():
        types.append(q.get_nowait()["type"])
    bus.unsubscribe(q)
    assert types.count("training.metrics") == 4 and "training.updated" in types

    cmd = client.get("/training/jobs/job_001/command").json()["command"]
    assert "--output_dir=" in cmd and "--job_name=job_001" in cmd and "--steps=20" in cmd
    assert (local.job_dir("job_001") / "train.log").is_file()


def test_job_log(client, dataset):
    client.post("/training/jobs", json=SMALL)
    wait_for("job_001", "done")
    body = client.get("/training/jobs/job_001/log").json()
    assert body["truncated"] is False
    assert body["lines"][-1].endswith("End of training")
    # tqdm redraws collapse to the last state on their line
    assert not any("\r" in line for line in body["lines"])
    assert any(line.startswith("Training: 100%") for line in body["lines"])
    short = client.get("/training/jobs/job_001/log", params={"tail": 2}).json()
    assert len(short["lines"]) == 2 and short["truncated"] is True
    assert client.get("/training/jobs/nope/log").status_code == 404


def test_failed_job_reports_the_error(client, dataset, monkeypatch):
    monkeypatch.setenv("FAKE_TRAINER_FAIL", "1")
    client.post("/training/jobs", json=SMALL)
    job = wait_for("job_001", "failed")
    assert job["error"] == "torch.OutOfMemoryError: CUDA out of memory."


def test_queue_and_stop(client, dataset, monkeypatch):
    monkeypatch.setenv("FAKE_TRAINER_SLOW", "1")
    a = client.post("/training/jobs", json={**SMALL, "overrides": {"steps": 200}}).json()
    b = client.post("/training/jobs", json=SMALL).json()
    assert (a["status"], b["status"]) == ("running", "queued")
    assert client.get("/training/config").json()["localGpus"][0]["busyBy"] == "job_001"
    assert client.post("/training/jobs/job_001/stop").status_code == 200
    assert wait_for("job_001", "stopped")["status"] == "stopped"
    wait_for("job_002", "running", "done")
    assert client.post("/training/jobs/job_002/stop").status_code == 200
    wait_for("job_002", "stopped", "done")
    assert client.post("/training/jobs/job_002/stop").status_code == 409


def test_stop_queued_job(client, dataset, monkeypatch):
    monkeypatch.setenv("FAKE_TRAINER_SLOW", "1")
    client.post("/training/jobs", json={**SMALL, "overrides": {"steps": 200}})
    client.post("/training/jobs", json=SMALL)
    assert client.post("/training/jobs/job_002/stop").json()["status"] == "stopped"
    client.post("/training/jobs/job_001/stop")
    wait_for("job_001", "stopped")
    assert training.get_job("job_002").status == "stopped"


def test_save_checkpoint_as_model(client, dataset):
    client.post("/training/jobs", json=SMALL)
    wait_for("job_001", "done")
    r = client.post("/training/jobs/job_001/checkpoints/10/save", json={"name": "Stack v1"})
    assert r.status_code == 201, r.text
    m = r.json()
    assert m["id"] == "stack-v1" and m["step"] == 10 and m["loss"] > 0 and m["sizeMB"] > 0
    assert (models.folder("stack-v1") / "pretrained_model" / "model.safetensors").is_file()
    again = client.post("/training/jobs/job_001/checkpoints/10/save", json={"name": "Stack v1"})
    assert again.json()["id"] == "stack-v1-2"
    assert (
        client.post("/training/jobs/job_001/checkpoints/15/save", json={"name": "x"}).status_code
        == 404
    )


def test_jobs_survive_a_restart(client, dataset):
    client.post("/training/jobs", json=SMALL)
    wait_for("job_001", "done")
    training.reset()
    job = client.get("/training/jobs/job_001").json()
    assert job["status"] == "done" and len(job["checkpoints"]) == 2
    assert len(client.get("/training/jobs/job_001/metrics").json()["series"]["loss"]) == 4
    assert client.post("/training/jobs", json=SMALL).json()["id"] == "job_002"


def test_running_job_without_process_fails_on_restart(client, dataset, monkeypatch):
    monkeypatch.setenv("FAKE_TRAINER_SLOW", "1")
    client.post("/training/jobs", json={**SMALL, "overrides": {"steps": 200}})
    local.reset()  # kills the trainer, as a reboot would
    training.reset()
    job = training.get_job("job_001")
    assert job.status == "failed" and "backend was down" in job.error


def test_runpod_has_no_trainer(client, dataset):
    r = client.post("/training/jobs", json=RUNPOD)
    assert r.status_code == 503
    assert r.json()["error"]["message"] == "RunPod trainer is not connected yet"
    assert client.get("/training/jobs").json() == []


def test_create_bad_body(client):
    assert client.post("/training/jobs", json={"dataset": "x"}).status_code == 422


def test_command_preview(client, dataset):
    body = {**RUNPOD, "overrides": {"steps": 100000, "policy.use_amp": True, "seed": 7}}
    p = client.post("/training/command-preview", json=body).json()
    root = config.datasets_dir / "local" / "stack"
    assert p["command"] == (
        "lerobot-train --policy.path=lerobot/smolvla_base --dataset.repo_id=local/stack"
        f" --dataset.root={root} --policy.device=cuda --policy.push_to_hub=false"
        " --wandb.enable=false --seed=7 --policy.use_amp=true"
    )
    rate = 1.64 * 2 * 0.8 * 0.5
    assert p["ratePerHr"] == round(rate, 4)
    assert p["capHours"] == round(3 / rate, 2)
    assert p["maxCostUsd"] == 3
    local = client.post("/training/command-preview", json=LOCAL).json()
    assert local.get("ratePerHr") is None


@pytest.mark.parametrize(
    "patch,loc",
    [
        ({"dataset": "local/nope"}, "dataset"),
        ({"overrides": {"nope": 1}}, "nope"),
        ({"overrides": {"steps": 0}}, "steps"),
        ({"gpu": "GTX 1080"}, "gpu"),
        ({"runpod": {"region": "MARS-1"}}, "region"),
    ],
)
def test_command_preview_validation(client, dataset, patch, loc):
    r = client.post("/training/command-preview", json={**RUNPOD, **patch})
    assert r.status_code == 422, r.text
    assert loc in r.json()["error"]["details"]["errors"][0]["loc"]


def test_preview_local_gpu_must_be_detected(client, dataset, monkeypatch):
    monkeypatch.setattr(gpu, "detect", lambda: ())
    r = client.post("/training/command-preview", json=LOCAL)
    assert r.status_code == 422

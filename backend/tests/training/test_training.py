"""Training: real options and command preview; no trainer is connected, so no job starts."""

import pytest

from app.utils import gpu
from tests.support import write_recording

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


@pytest.mark.parametrize("body", [LOCAL, RUNPOD])
def test_create_needs_a_trainer(client, dataset, body):
    r = client.post("/training/jobs", json=body)
    assert r.status_code == 503
    assert r.json()["error"]["message"] == "Trainer is not connected yet"
    assert client.get("/training/jobs").json() == []


def test_create_bad_body(client):
    assert client.post("/training/jobs", json={"dataset": "x"}).status_code == 422


def test_command_preview(client, dataset):
    body = {**RUNPOD, "overrides": {"steps": 100000, "policy.use_amp": True, "seed": 7}}
    p = client.post("/training/command-preview", json=body).json()
    assert p["command"] == (
        "lerobot-train --policy.path=lerobot/smolvla_base --dataset.repo_id=local/stack"
        " --policy.device=cuda --seed=7 --policy.use_amp=true"
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

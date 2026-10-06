"""RunPod jobs: remote.py against a fake RunPod API and a fake pod runner (no network)."""

import base64
import gzip
import json
import time

import pytest

from app.services import datasets, training
from app.services.training import remote, runpod_api
from tests.support import write_recording

BODY = {
    "dataset": "local/stack",
    "compute": "runpod",
    "gpu": "RTX 4090",
    "overrides": {"steps": 20, "batch_size": 4, "log_freq": 5},
    "runpod": {"maxHours": 2, "terminateOnFinish": True},
}
LOG = (
    "[mimic] phase: training\n"
    "Training:  25%|##| 5/20 [00:01<00:03,  4.00step/s]\n"
    "INFO ot_train.py:641 step:5 smpl:20 ep:0 epch:0.05 loss:0.500 grdn:1.500 lr:1.0e-04"
    " updt_s:0.200 data_s:0.002 smp/s:20 mem_gb:2.12\n"
)


class FakePod:
    """RunPod API + runner state the test drives."""

    def __init__(self) -> None:
        self.specs: list[dict] = []
        self.deleted: list[str] = []
        self.posts: list[str] = []
        self.repos_deleted: list[str] = []
        self.status: dict | None = None  # None: runner not answering yet
        self.log = b""
        self.pod_status = "RUNNING"

    def create_pod(self, spec):
        self.specs.append(spec)
        return {"id": "pod123", "costPerHr": 0.69, "desiredStatus": "RUNNING"}

    def runner_status(self, r):
        return None if self.status is None else {**self.status, "logSize": len(self.log)}

    def runner_log(self, r, offset):
        return self.log[offset : offset + 64]

    def runner_post(self, r, name):
        self.posts.append(name)
        if name == "stop" and self.status:
            self.status = {**self.status, "phase": "stopped"}
        return True

    def download_checkpoint(self, r, dirname):
        d = remote.local.output_dir(r.job.id) / "checkpoints" / dirname / "pretrained_model"
        d.mkdir(parents=True, exist_ok=True)
        (d / "model.safetensors").write_bytes(b"\0" * 2_000_000)
        return d


@pytest.fixture
def pod(monkeypatch):
    fake = FakePod()
    monkeypatch.setattr(remote, "POLL_S", 0.02)
    monkeypatch.setattr(runpod_api, "key_set", lambda: True)
    monkeypatch.setattr(runpod_api, "create_pod", fake.create_pod)
    monkeypatch.setattr(runpod_api, "delete_pod", fake.deleted.append)
    monkeypatch.setattr(runpod_api, "get_pod", lambda pid: {"desiredStatus": fake.pod_status})
    monkeypatch.setattr(datasets, "hf_token", lambda: "hf_test")
    monkeypatch.setattr(datasets, "hf_namespace", lambda token: "vla-lab")
    monkeypatch.setattr(datasets, "upload", lambda repo_id, private=None: "vla-lab/stack")
    for name in ("runner_status", "runner_log", "runner_post", "download_checkpoint"):
        monkeypatch.setattr(remote, name, getattr(fake, name))
    monkeypatch.setattr(remote, "delete_model_repo", fake.repos_deleted.append)
    yield fake
    remote.reset()


@pytest.fixture
def dataset(client, task):
    write_recording(1)
    body = {"taskId": "stack-two-blocks", "repoId": "local/stack"}
    assert client.post("/convert", json=body).status_code == 202
    assert datasets.wait("local/stack").status == "ready"


def until(cond, timeout: float = 5):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if v := cond():
            return v
        time.sleep(0.02)
    raise AssertionError("condition not met")


def job(client, job_id="job_001") -> dict:
    return client.get(f"/training/jobs/{job_id}").json()


def test_runpod_job_runs_to_done(client, dataset, pod):
    r = client.post("/training/jobs", json=BODY)
    assert r.status_code == 202, r.text
    body = r.json()
    assert body["status"] == "running" and body["compute"] == "runpod"
    assert body["phase"] in ("pushing dataset", "starting pod") and body["pricePerHr"] == 0.69

    until(lambda: pod.specs)
    spec = pod.specs[0]
    assert spec["gpuTypeIds"] == ["NVIDIA GeForce RTX 4090"] and spec["cloudType"] == "SECURE"
    assert spec["ports"] == ["8000/http"] and spec["volumeInGb"] == 0
    assert spec["env"]["HF_TOKEN"] == "hf_test"
    runner = gzip.decompress(base64.b64decode(spec["env"]["MIMIC_RUNNER"])).decode()
    assert "def main()" in runner
    cfg = json.loads(spec["env"]["MIMIC_JOB"])
    assert cfg["datasetRepo"] == "vla-lab/stack" and cfg["capHours"] == 2
    assert cfg["modelRepo"] == "vla-lab/smolvla_stack_two_blocks_job_001"
    assert "--dataset.root={dataset_root}" in cfg["trainArgs"]
    assert "--dataset.repo_id=vla-lab/stack" in cfg["trainArgs"]
    assert until(lambda: job(client)["pod"] == "pod123")
    assert job(client)["podState"]["state"] == "running"
    # The token stays in job.yaml, never in the API
    assert "token" not in json.dumps(job(client)).lower()

    pod.status = {"phase": "training", "checkpoints": [], "gpuUtil": 80.0}
    pod.log = LOG.encode()
    until(lambda: job(client)["step"] == 5)
    assert job(client)["phase"] == "training"
    m = client.get("/training/jobs/job_001/metrics").json()["series"]
    assert m["loss_raw"] == [0.5] and m["gpu_util"] == [80.0]
    assert "step:5" in "\n".join(client.get("/training/jobs/job_001/log").json()["lines"])

    pod.status = {"phase": "done", "checkpoints": [{"step": 20, "dir": "000020", "sizeMB": 2}]}
    done = until(lambda: job(client)["status"] == "done" and job(client))
    assert done["step"] == 20 and done["phase"] is None and done["costUsd"] >= 0
    assert [c["step"] for c in done["checkpoints"]] == [20]
    assert done["podState"]["state"] == "terminated"
    assert pod.deleted == ["pod123"] and "ack" in pod.posts
    assert pod.repos_deleted == ["vla-lab/smolvla_stack_two_blocks_job_001"]  # no pushToHub
    # The downloaded checkpoint can be saved as a model like a local one
    r = client.post("/training/jobs/job_001/checkpoints/20/save", json={"name": "Cloud run"})
    assert r.status_code == 201, r.text


def test_runpod_stop_and_idle_pod(client, dataset, pod):
    body = {**BODY, "runpod": {**BODY["runpod"], "terminateOnFinish": False, "pushToHub": True}}
    client.post("/training/jobs", json=body)
    pod.status = {"phase": "training", "checkpoints": []}
    until(lambda: job(client)["phase"] == "training")
    assert client.post("/training/jobs/job_001/stop").status_code == 200
    j = until(lambda: job(client)["status"] == "stopped" and job(client))
    assert "stop" in pod.posts and pod.deleted == [] and pod.repos_deleted == []
    assert j["podState"]["state"] == "idle" and j["podState"]["idleForS"] >= 0
    r = client.post("/training/jobs/job_001/pod/terminate")
    assert r.status_code == 200 and r.json()["podState"]["state"] == "terminated"
    assert pod.deleted == ["pod123"]


def test_runpod_stop_before_the_pod_answers(client, dataset, pod):
    client.post("/training/jobs", json=BODY)
    until(lambda: job(client)["pod"] == "pod123")
    client.post("/training/jobs/job_001/stop")
    j = until(lambda: job(client)["status"] == "stopped" and job(client))
    assert pod.deleted == ["pod123"] and j["podState"]["state"] == "terminated"


def test_runpod_spot_interruption_fails(client, dataset, pod, monkeypatch):
    monkeypatch.setattr(remote, "POD_CHECK_S", 0.0)
    client.post("/training/jobs", json=BODY)
    pod.status = {"phase": "training", "checkpoints": []}
    until(lambda: job(client)["phase"] == "training")
    pod.pod_status = "EXITED"
    j = until(lambda: job(client)["status"] == "failed" and job(client))
    assert "exited" in j["error"]


def test_runpod_push_failure_fails_the_job(client, dataset, pod, monkeypatch):
    from app.core.errors import ApiError

    def fail(repo_id, private=None):
        raise ApiError(502, "Hugging Face Hub request failed")

    monkeypatch.setattr(datasets, "upload", fail)
    client.post("/training/jobs", json=BODY)
    j = until(lambda: job(client)["status"] == "failed" and job(client))
    assert j["error"] == "Hugging Face Hub request failed" and pod.specs == []


def test_runpod_job_is_followed_after_a_restart(client, dataset, pod):
    client.post("/training/jobs", json=BODY)
    pod.status = {"phase": "training", "checkpoints": []}
    pod.log = LOG.encode()
    until(lambda: job(client)["step"] == 5)
    training.reset()  # backend restart: job.yaml has the runner token and log offset
    assert remote.is_following("job_001")
    pod.status = {"phase": "done", "checkpoints": []}
    j = until(lambda: job(client)["status"] == "done" and job(client))
    assert len(client.get("/training/jobs/job_001/metrics").json()["series"]["loss_raw"]) == 1
    assert j["podState"]["state"] == "terminated"

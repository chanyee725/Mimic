"""pod_runner.py as a real process: HTTP API, log, checkpoint upload, stop (no install, no Hub)."""

import json
import os
import socket
import subprocess
import sys
import time
from pathlib import Path

import httpx
import pytest

from app.services.training import pod_runner

TOKEN = "t0ken"

FAKE_TRAINER = f"""#!{sys.executable}
import os, sys, time
from pathlib import Path
out = Path(next(a.split("=", 1)[1] for a in sys.argv if a.startswith("--output_dir=")))
print("INFO Start training", flush=True)
if os.environ.get("FAKE_FAIL"):
    raise ValueError("bad dataset")
if os.environ.get("FAKE_SLEEP"):
    time.sleep(float(os.environ["FAKE_SLEEP"]))
print("step:2 smpl:8 ep:0 epch:0.10 loss:1.234 grdn:2.0 lr:1.0e-04 updt_s:0.1 data_s:0.01", flush=True)
ck = out / "checkpoints" / "000002" / "pretrained_model"
ck.mkdir(parents=True)
(ck / "model.safetensors").write_bytes(b"x" * 1000)
(out / "checkpoints" / "last").symlink_to("000002")
print("INFO Checkpoint policy after step 2", flush=True)
print("INFO End of training", flush=True)
"""


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture
def runner(tmp_path):
    procs: list[subprocess.Popen] = []

    def start(**env) -> str:
        venv = tmp_path / "venv"
        (venv / "bin").mkdir(parents=True)
        py = venv / "bin" / "python"  # huggingface_hub snippets: succeed without doing anything
        py.write_text("#!/bin/sh\nexit 0\n")
        trainer = venv / "bin" / "lerobot-train"
        trainer.write_text(FAKE_TRAINER)
        for f in (py, trainer):
            f.chmod(0o755)
        port = _free_port()
        job = {
            "jobId": "job_001",
            "token": TOKEN,
            "port": port,
            "workdir": str(tmp_path / "work"),
            "install": False,
            "venv": str(venv),
            "datasetRoot": str(tmp_path / "ds"),
            "modelRepo": "op-01/smolvla_test_job_001",
            "trainArgs": ["--dataset.root={dataset_root}"],
            "capHours": 0,
            "terminateOnFinish": True,
            "ackWaitS": 1,
            "pollS": 0.2,
        }
        clean = {k: v for k, v in os.environ.items() if not k.startswith("RUNPOD_")}
        p = subprocess.Popen(
            [sys.executable, pod_runner.__file__],
            env={**clean, "MIMIC_JOB": json.dumps(job), **env},
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        procs.append(p)
        base = f"http://127.0.0.1:{port}"
        for _ in range(100):
            try:
                httpx.get(f"{base}/{TOKEN}/status", timeout=1)
                return base
            except httpx.HTTPError:
                time.sleep(0.05)
        raise AssertionError("runner did not start")

    yield start
    for p in procs:
        p.kill()
        p.wait(timeout=5)


def _wait_phase(base: str, phases: tuple[str, ...], timeout: float = 10) -> dict:
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        st = httpx.get(f"{base}/{TOKEN}/status").json()
        if st["phase"] in phases:
            return st
        time.sleep(0.1)
    raise AssertionError(f"phase never reached {phases}: {st}")


def test_runs_a_job(runner):
    base = runner()
    assert httpx.get(f"{base}/wrong/status").status_code == 404
    assert httpx.get(f"{base}/{TOKEN}/nope").status_code == 404
    st = _wait_phase(base, ("done", "failed"))
    assert st["phase"] == "done" and st["exitCode"] == 0 and st["error"] is None
    assert st["checkpoints"] == [{"step": 2, "dir": "000002", "sizeMB": 0.0}]

    r = httpx.get(f"{base}/{TOKEN}/log", params={"offset": 0})
    size = int(r.headers["X-Log-Size"])
    assert size == len(r.content) == st["logSize"]
    text = r.content.decode()
    assert "step:2 smpl:8" in text and "End of training" in text
    assert "--dataset.root=" in text and "{dataset_root}" not in text
    assert "uploading checkpoint 000002" in text
    tail = httpx.get(f"{base}/{TOKEN}/log", params={"offset": 10})
    assert tail.content == r.content[10:]
    assert httpx.get(f"{base}/{TOKEN}/log", params={"offset": size + 5}).content == b""

    assert httpx.post(f"{base}/{TOKEN}/ack").status_code == 200
    assert httpx.post(f"{base}/wrong/ack").status_code == 404


def test_stop(runner):
    base = runner(FAKE_SLEEP="60")
    _wait_phase(base, ("training",))
    assert httpx.post(f"{base}/{TOKEN}/stop").status_code == 200
    st = _wait_phase(base, ("stopped", "done", "failed"))
    assert st["phase"] == "stopped" and st["checkpoints"] == []
    log = httpx.get(f"{base}/{TOKEN}/log").content.decode()
    assert "stop requested" in log and "phase: stopped" in log


def test_failure_reports_the_last_exception(runner):
    base = runner(FAKE_FAIL="1")
    st = _wait_phase(base, ("done", "failed"))
    assert st["phase"] == "failed" and st["exitCode"] == 1
    assert st["error"] == "ValueError: bad dataset"


def test_runner_file_is_stdlib_only():
    src = Path(pod_runner.__file__).read_text()
    assert "import huggingface_hub" not in src and "from app" not in src

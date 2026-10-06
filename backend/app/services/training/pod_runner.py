"""Runs one training job on a RunPod pod. Standalone: stdlib only, never imported by the app.

The station sends this file to the pod (base64 in MIMIC_RUNNER) with the job in MIMIC_JOB (JSON)
and HF_TOKEN. Steps: install lerobot into a venv, download the dataset from the Hub, create the
checkpoint repo, run lerobot-train, upload every checkpoint's pretrained_model/ as it lands,
then wait for the station to collect the result and terminate the pod (RUNPOD_API_KEY is the
pod-scoped key RunPod injects).

The station follows it through a small HTTP server behind RunPod's proxy; every path starts with
the job's secret token:
  GET  /<token>/status          phase, exit code, error, uploaded checkpoints, GPU use, log size
  GET  /<token>/log?offset=N    train.log from byte N (at most 1 MB)
  POST /<token>/stop            stop the trainer (or the install / download in progress)
  POST /<token>/ack             the station has everything: finish now
"""

import json
import os
import re
import signal
import subprocess
import sys
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

JOB = json.loads(os.environ.get("MIMIC_JOB", "{}"))
TOKEN = JOB.get("token", "")
WORK = Path(JOB.get("workdir", "/workspace/mimic")) / JOB.get("jobId", "job")
LOG = WORK / "train.log"
OUTPUT = WORK / "output"
VENV = Path(JOB.get("venv", "/opt/mimic-venv"))
FINAL = ("done", "failed", "stopped")
LOG_CHUNK = 1024 * 1024
POLL_S = float(JOB.get("pollS", 5))
STOP_GRACE_S = 20
ACK_WAIT_S = int(JOB.get("ackWaitS", 20 * 60))

state = {
    "phase": "starting",
    "exitCode": None,
    "error": None,
    "checkpoints": [],  # [{step, dir, sizeMB}] uploaded to the model repo
    "gpuUtil": None,
    "startedAt": time.time(),
}
lock = threading.Lock()
stop_requested = threading.Event()
acked = threading.Event()
current: list[subprocess.Popen] = []  # the step's process (install, download, trainer)


def say(msg: str) -> None:
    with LOG.open("a") as f:
        f.write(f"[mimic] {msg}\n")


def set_phase(phase: str, **extra) -> None:
    with lock:
        state["phase"] = phase
        state.update(extra)
    say(f"phase: {phase}")


# --- HTTP ---


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args) -> None:  # keep the pod's stdout quiet
        pass

    def _route(self) -> tuple[str, dict] | None:
        url = urlparse(self.path)
        parts = url.path.strip("/").split("/")
        if len(parts) != 2 or not TOKEN or parts[0] != TOKEN:
            self.send_error(404)
            return None
        return parts[1], parse_qs(url.query)

    def _send(self, code: int, body: bytes, ctype: str, headers: dict | None = None) -> None:
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        route = self._route()
        if route is None:
            return
        name, query = route
        if name == "status":
            with lock:
                body = {**state, "logSize": LOG.stat().st_size if LOG.exists() else 0}
            self._send(200, json.dumps(body).encode(), "application/json")
        elif name == "log":
            offset = int((query.get("offset") or ["0"])[0])
            data = b""
            size = LOG.stat().st_size if LOG.exists() else 0
            if LOG.exists() and offset < size:
                with LOG.open("rb") as f:
                    f.seek(offset)
                    data = f.read(LOG_CHUNK)
            self._send(200, data, "application/octet-stream", {"X-Log-Size": str(size)})
        else:
            self.send_error(404)

    def do_POST(self) -> None:
        route = self._route()
        if route is None:
            return
        name, _ = route
        if name == "stop":
            request_stop()
        elif name == "ack":
            acked.set()
        else:
            self.send_error(404)
            return
        self._send(200, b"{}", "application/json")


def request_stop() -> None:
    if stop_requested.is_set():
        return
    stop_requested.set()
    say("stop requested")
    for p in list(current):
        signal_group(p, signal.SIGTERM)


def signal_group(p: subprocess.Popen, sig: int) -> None:
    try:
        os.killpg(p.pid, sig)
    except (ProcessLookupError, PermissionError):
        pass


# --- steps ---


class Stopped(Exception):
    pass


def run(cmd: list[str], env: dict | None = None) -> int:
    """Runs cmd with its output appended to train.log; Stopped when a stop came in."""
    if stop_requested.is_set():
        raise Stopped
    with LOG.open("ab") as out:
        p = subprocess.Popen(
            cmd,
            stdout=out,
            stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            env={**os.environ, "PYTHONUNBUFFERED": "1", **(env or {})},
            start_new_session=True,
        )
    current.append(p)
    try:
        code = p.wait()
    finally:
        current.remove(p)
    if stop_requested.is_set():
        raise Stopped
    return code


def must(cmd: list[str], what: str) -> None:
    if run(cmd) != 0:
        raise RuntimeError(f"{what} failed (see the log)")


def py() -> str:
    return str(VENV / "bin" / "python")


def hf(code: str, what: str) -> None:
    """Runs a huggingface_hub snippet in the venv (the runner itself has only the stdlib)."""
    must([py(), "-c", "from huggingface_hub import HfApi, snapshot_download\n" + code], what)


def install() -> None:
    set_phase("installing")
    spec = JOB["lerobot"]
    marker = VENV / ".mimic-lerobot"
    if marker.exists() and marker.read_text() == spec:
        say(f"{spec} already installed in {VENV}")
        return
    # System site-packages keep the image's CUDA torch when it fits lerobot's range
    must([sys.executable, "-m", "venv", "--system-site-packages", str(VENV)], "Creating the venv")
    must([py(), "-m", "pip", "install", "--progress-bar", "off", "-U", "pip"], "pip upgrade")
    must([py(), "-m", "pip", "install", "--progress-bar", "off", spec], f"Installing {spec}")
    marker.write_text(spec)


def download_dataset() -> Path:
    set_phase("downloading")
    root = Path(JOB["datasetRoot"])
    repo = JOB["datasetRepo"]
    hf(
        f"snapshot_download({repo!r}, repo_type='dataset', local_dir={str(root)!r},"
        f" revision={JOB.get('datasetRevision')!r})",
        "Dataset download",
    )
    return root


def create_model_repo() -> None:
    hf(
        f"HfApi().create_repo({JOB['modelRepo']!r}, private=True, exist_ok=True)",
        "Creating the checkpoint repo",
    )


def checkpoint_dirs() -> list[Path]:
    """Saved checkpoints up to the one checkpoints/last points at (written after saving)."""
    root = OUTPUT / "checkpoints"
    last = root / "last"
    try:
        last_step = int(last.resolve().name)
    except (OSError, ValueError):
        return []
    return sorted(
        p
        for p in root.glob("[0-9]*")
        if p.name.isdigit() and int(p.name) <= last_step and (p / "pretrained_model").is_dir()
    )


def upload_new_checkpoints() -> None:
    done = {c["step"] for c in state["checkpoints"]}
    for d in checkpoint_dirs():
        step = int(d.name)
        if step in done:
            continue
        src = d / "pretrained_model"
        size = sum(p.stat().st_size for p in src.rglob("*") if p.is_file())
        say(f"uploading checkpoint {d.name} ({size / 1e6:.0f} MB)")
        # A stop must not cut an upload short: run it outside run()'s stop check
        with LOG.open("ab") as out:
            code = subprocess.call(
                [
                    py(),
                    "-c",
                    "from huggingface_hub import HfApi\n"
                    f"HfApi().upload_folder(repo_id={JOB['modelRepo']!r}, folder_path={str(src)!r},"
                    f" path_in_repo='checkpoints/{d.name}/pretrained_model',"
                    f" commit_message='Checkpoint {d.name}')",
                ],
                stdout=out,
                stderr=subprocess.STDOUT,
            )
        if code != 0:
            raise RuntimeError(f"Uploading checkpoint {d.name} failed (see the log)")
        with lock:
            state["checkpoints"].append(
                {"step": step, "dir": d.name, "sizeMB": round(size / 1e6, 1)}
            )


def gpu_util() -> float | None:
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=utilization.gpu", "--format=csv,noheader,nounits"],
            capture_output=True,
            text=True,
            timeout=5,
        ).stdout
        vals = [float(v) for v in out.split()]
        return round(sum(vals) / len(vals), 1) if vals else None
    except (OSError, ValueError, subprocess.SubprocessError):
        return None


def train(dataset_root: Path) -> int:
    if stop_requested.is_set():
        raise Stopped
    set_phase("training")
    args = [a.replace("{dataset_root}", str(dataset_root)) for a in JOB["trainArgs"]]
    args += [f"--output_dir={OUTPUT}", f"--job_name={JOB.get('jobId', 'job')}"]
    trainer = str(VENV / "bin" / "lerobot-train")
    gpus = int(JOB.get("gpuCount", 1))
    if gpus > 1:
        cmd = [str(VENV / "bin" / "accelerate"), "launch", "--multi_gpu"]
        cmd += [f"--num_processes={gpus}", trainer, *args]
    else:
        cmd = [trainer, *args]
    say("$ " + " ".join(cmd))
    deadline = state["startedAt"] + float(JOB.get("capHours") or 0) * 3600
    with LOG.open("ab") as out:
        p = subprocess.Popen(
            cmd,
            stdout=out,
            stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            env={**os.environ, "PYTHONUNBUFFERED": "1"},
            start_new_session=True,
        )
    current.append(p)
    killed_at = None
    while p.poll() is None:
        time.sleep(POLL_S)
        state["gpuUtil"] = gpu_util()
        if JOB.get("capHours") and time.time() > deadline and not stop_requested.is_set():
            say("time / budget limit reached")
            request_stop()
        if stop_requested.is_set():
            killed_at = killed_at or time.time()
            if time.time() - killed_at > STOP_GRACE_S:
                signal_group(p, signal.SIGKILL)
        try:
            upload_new_checkpoints()
        except RuntimeError as e:
            say(str(e))
    current.remove(p)
    upload_new_checkpoints()
    return p.returncode


def last_error() -> str | None:
    """Last exception line of the log, like the station's local trainer reports."""
    try:
        lines = LOG.read_text(errors="replace").splitlines()[-200:]
    except OSError:
        return None
    for line in reversed(lines):
        if re.match(r"^\w+(\.\w+)*(Error|Exception)\b", line.strip()):
            return line.strip()[:500]
    return None


# --- finish ---


def terminate_self() -> None:
    pod, key = os.environ.get("RUNPOD_POD_ID"), os.environ.get("RUNPOD_API_KEY")
    if not pod:
        return
    say(f"terminating pod {pod}")
    if key:
        req = urllib.request.Request(
            f"https://rest.runpod.io/v1/pods/{pod}",
            method="DELETE",
            headers={"Authorization": f"Bearer {key}"},
        )
        try:
            urllib.request.urlopen(req, timeout=30)
            return
        except OSError as e:
            say(f"REST terminate failed: {e}")
    subprocess.call(["runpodctl", "remove", "pod", pod])


def main() -> None:
    WORK.mkdir(parents=True, exist_ok=True)
    port = int(JOB.get("port", 8000))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    say(f"runner up on :{port} for {JOB.get('jobId')}")
    try:
        if JOB.get("install", True):
            install()
        root = download_dataset() if JOB.get("datasetRepo") else Path(JOB["datasetRoot"])
        if JOB.get("modelRepo"):
            create_model_repo()
        code = train(root)
        ended = "End of training" in LOG.read_text(errors="replace")[-20000:]
        if stop_requested.is_set():
            set_phase("stopped", exitCode=code)
        elif code == 0 or ended:
            set_phase("done", exitCode=code)
        else:
            set_phase(
                "failed", exitCode=code, error=last_error() or f"lerobot-train exited with {code}"
            )
    except Stopped:
        set_phase("stopped")
    except Exception as e:  # any failure ends the job as failed
        set_phase("failed", error=str(e) or type(e).__name__)
    # The station acks once it has the checkpoints; without it the pod still ends in time
    acked.wait(ACK_WAIT_S)
    if JOB.get("terminateOnFinish", True):
        terminate_self()
    while True:  # the pod stays up (idle) until the station or the user terminates it
        time.sleep(3600)


if __name__ == "__main__":
    main()

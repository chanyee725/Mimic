"""Local trainer: runs lerobot-train as a detached process and follows its log.

The process gets its own session, so a backend restart (or uvicorn --reload) leaves it running;
reset() finds it again from the pid in job.yaml. One watcher thread reads every run's log
(tqdm progress, metric lines, checkpoints) and reports through the callbacks jobs.py passes in.
"""

import json
import logging
import os
import re
import signal
import subprocess
import sys
import threading
import time
from collections import deque
from datetime import datetime
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

from app.configs.config import config
from app.models.training import Checkpoint, TrainJob
from app.services.training import logparse
from app.utils import gpu
from app.utils.time import now_iso

log = logging.getLogger(__name__)

TICK_S = 0.5
PUBLISH_EVERY_S = 2.0  # training.updated while only the step moves
STOP_GRACE_S = 15.0  # SIGTERM → SIGKILL
LOSS_SMOOTHING = 0.3  # EMA weight of the newest logged loss
TAIL_LINES = 200
PROCESS_MARK = b"lerobot-train"  # in /proc/<pid>/cmdline of a live trainer (tests swap it)

Sample = tuple[int, dict[str, float]]


def job_dir(job_id: str) -> Path:
    return config.training_dir / job_id


def output_dir(job_id: str) -> Path:
    return job_dir(job_id) / "output"


def log_path(job_id: str) -> Path:
    return job_dir(job_id) / "train.log"


def metrics_path(job_id: str) -> Path:
    return job_dir(job_id) / "metrics.jsonl"


def checkpoint_dir(job_id: str, step: int) -> Path:
    """lerobot's layout: output/checkpoints/<step, zero-padded to the total's width>."""
    root = output_dir(job_id) / "checkpoints"
    matches = [p for p in root.glob("[0-9]*") if p.name.isdigit() and int(p.name) == step]
    return matches[0] if matches else root / f"{step:06d}"


def trainer_cmd() -> list[str]:
    """lerobot-train next to the backend's Python (the uv venv), else the one on PATH."""
    exe = Path(sys.executable).with_name("lerobot-train")
    return [str(exe) if exe.exists() else "lerobot-train"]


@dataclass
class Callbacks:
    save: Callable[[TrainJob], None]  # job.yaml
    updated: Callable[[TrainJob], None]  # training.updated
    metric: Callable[[TrainJob, int, dict[str, float]], None]  # training.metrics
    finished: Callable[[TrainJob], None]  # start the next queued job


@dataclass
class Run:
    job: TrainJob
    proc: subprocess.Popen | None  # None after a backend restart (only the pid is known)
    pid: int
    log_freq: int
    gpu_index: int
    offset: int = 0
    partial: str = ""
    tail: deque = field(default_factory=lambda: deque(maxlen=TAIL_LINES))
    logged: int = 0  # metric lines seen in the log so far
    known: int = 0  # metric lines already in metrics.jsonl (skipped when re-reading the log)
    loss: float | None = None  # smoothed
    pending: set[int] = field(default_factory=set)  # checkpoints announced, not yet on disk
    ended: bool = False  # "End of training" seen
    stopping: bool = False
    stop_at: float | None = None
    published: float = 0.0


_runs: dict[str, Run] = {}
_lock = threading.RLock()
_thread: threading.Thread | None = None
_cb: Callbacks | None = None


def configure(callbacks: Callbacks) -> None:
    global _cb
    _cb = callbacks


def reset() -> None:
    """Forget the runs (tests); their processes are killed."""
    with _lock:
        for run in _runs.values():
            if run.proc is not None:
                _signal(run.pid, signal.SIGKILL)
                run.proc.wait(timeout=5)
        _runs.clear()


def is_running(job_id: str) -> bool:
    with _lock:
        return job_id in _runs


# Log


LOG_READ_BYTES = 512 * 1024  # end of train.log read for the log view


def read_log(job_id: str, tail: int) -> tuple[list[str], bool]:
    """Last `tail` lines of train.log with tqdm's \r redraws collapsed to their last state.

    Returns the lines and whether older output was left out.
    """
    p = log_path(job_id)
    try:
        size = p.stat().st_size
        with p.open("rb") as f:
            f.seek(max(0, size - LOG_READ_BYTES))
            text = f.read().decode(errors="replace")
    except OSError:
        return [], False
    rows = text.split("\n")
    if size > LOG_READ_BYTES:
        rows = rows[1:]  # the first row starts mid-line
    lines = []
    for r in rows:
        last = r.rstrip("\r").rsplit("\r", 1)[-1]
        # A log record printed right after a tqdm redraw shares its line: split them
        lines += re.split(r"(?<=\])(?=(?:INFO|WARNING|ERROR) )", last)
    while lines and not lines[-1].strip():
        lines.pop()
    return lines[-tail:], size > LOG_READ_BYTES or len(lines) > tail


# Samples


def load_samples(job_id: str) -> list[Sample]:
    p = metrics_path(job_id)
    if not p.is_file():
        return []
    out: list[Sample] = []
    for line in p.read_text().splitlines():
        try:
            row = json.loads(line)
            out.append((int(row["step"]), {k: float(v) for k, v in row["values"].items()}))
        except (ValueError, KeyError, TypeError):
            continue
    return out


def _append_sample(job_id: str, step: int, values: dict[str, float]) -> None:
    with metrics_path(job_id).open("a") as f:
        f.write(json.dumps({"step": step, "values": values}) + "\n")


# Start / stop / reattach


def pid_of(job_id: str) -> int | None:
    with _lock:
        run = _runs.get(job_id)
        return run.pid if run else None


def start(job: TrainJob, argv: list[str], gpu_index: int, log_freq: int) -> None:
    """Spawns lerobot-train for a queued job (output/ must not exist: lerobot refuses it)."""
    d = job_dir(job.id)
    d.mkdir(parents=True, exist_ok=True)
    env = {**os.environ, "CUDA_VISIBLE_DEVICES": str(gpu_index), "PYTHONUNBUFFERED": "1"}
    with log_path(job.id).open("ab") as out:
        proc = subprocess.Popen(
            argv,
            cwd=d,
            env=env,
            stdin=subprocess.DEVNULL,
            stdout=out,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
    job.status, job.started_at, job.step, job.error = "running", now_iso(), 0, None
    with _lock:
        _runs[job.id] = Run(job, proc, proc.pid, log_freq, gpu_index)
    _ensure_thread()


def reattach(job: TrainJob, pid: int | None, gpu_index: int, log_freq: int) -> bool:
    """Follows a job that was running before a restart; False when its process is gone."""
    if pid is None or not _alive(pid):
        return False
    known = len(load_samples(job.id))
    with _lock:
        _runs[job.id] = Run(job, None, pid, log_freq, gpu_index, known=known)
    _ensure_thread()
    return True


def stop(job_id: str) -> None:
    """SIGTERM to the trainer's process group; SIGKILL after STOP_GRACE_S."""
    with _lock:
        run = _runs.get(job_id)
        if run is None:
            return
        run.stopping, run.stop_at = True, time.monotonic() + STOP_GRACE_S
        _signal(run.pid, signal.SIGTERM)


def _signal(pid: int, sig: int) -> None:
    try:
        os.killpg(pid, sig)
    except (ProcessLookupError, PermissionError):
        pass


def _alive(pid: int) -> bool:
    """The pid is a live lerobot-train (pids are reused after a reboot)."""
    try:
        cmdline = Path(f"/proc/{pid}/cmdline").read_bytes()
    except OSError:
        return False
    status = Path(f"/proc/{pid}/stat").read_text(errors="ignore").split()
    if len(status) > 2 and status[2] == "Z":
        return False
    return PROCESS_MARK in cmdline


# Watcher


def _ensure_thread() -> None:
    global _thread
    if _thread is not None and _thread.is_alive():
        return
    _thread = threading.Thread(target=_loop, name="trainer-watch", daemon=True)
    _thread.start()


def _loop() -> None:
    while True:
        with _lock:
            runs = list(_runs.values())
        if not runs:
            return
        for run in runs:
            try:
                _tick(run)
            except Exception:  # keep following the other runs
                log.exception("Trainer watcher failed for %s", run.job.id)
        time.sleep(TICK_S)


def _tick(run: Run) -> None:
    exited = run.proc.poll() is not None if run.proc is not None else not _alive(run.pid)
    _read(run)
    _collect_checkpoints(run)
    if run.stopping and not exited and run.stop_at and time.monotonic() > run.stop_at:
        _signal(run.pid, signal.SIGKILL)
    _elapsed(run.job)
    if exited:
        _finish(run)
        return
    if time.monotonic() - run.published > PUBLISH_EVERY_S:
        run.published = time.monotonic()
        _cb.updated(run.job)


def _elapsed(job: TrainJob) -> None:
    """Wall time since start, model loading included (tqdm's clock starts at the first step)."""
    if job.started_at:
        started = datetime.fromisoformat(job.started_at)
        job.elapsed_s = max(0, int((datetime.now(started.tzinfo) - started).total_seconds()))


def _read(run: Run) -> None:
    p = log_path(run.job.id)
    try:
        with p.open("rb") as f:
            f.seek(run.offset)
            chunk = f.read()
    except OSError:
        return
    if not chunk:
        return
    run.offset += len(chunk)
    text = run.partial + chunk.decode(errors="replace")
    parts = text.replace("\r", "\n").split("\n")
    run.partial = parts.pop()
    for line in parts:
        if line.strip():
            _line(run, line)


def _line(run: Run, line: str) -> None:
    job = run.job
    run.tail.append(line)
    if (p := logparse.progress(line)) is not None:
        job.step, job.total = max(job.step, p.step), p.total
        job.eta_s, job.steps_per_s = p.eta_s, p.steps_per_s
    if (t := logparse.tracker(line)) is not None:
        run.logged += 1
        step = run.logged * run.log_freq
        job.step = max(job.step, step)
        job.epoch = int(t.epoch)
        values = dict(t.values)
        raw = values.get("loss_raw")
        if raw is not None:
            run.loss = raw if run.loss is None else run.loss + LOSS_SMOOTHING * (raw - run.loss)
            values["loss"] = round(run.loss, 4)
        if run.logged > run.known:
            util = gpu.utilization(run.gpu_index)
            if util is not None:
                values["gpu_util"] = util
            _append_sample(job.id, step, values)
            _cb.metric(job, step, values)
            _cb.save(job)
    if (step := logparse.checkpoint(line)) is not None:
        run.pending.add(step)
    if logparse.END in line:
        run.ended = True


def _collect_checkpoints(run: Run) -> None:
    """A checkpoint counts once lerobot points checkpoints/last at it (written after saving)."""
    if not run.pending:
        return
    last = output_dir(run.job.id) / "checkpoints" / "last"
    try:
        last_step = int(last.resolve().name)
    except (OSError, ValueError):
        return
    for step in sorted(s for s in run.pending if s <= last_step):
        run.pending.discard(step)
        d = checkpoint_dir(run.job.id, step) / "pretrained_model"
        if not d.is_dir():
            continue
        size = sum(p.stat().st_size for p in d.rglob("*") if p.is_file())
        ckpt = Checkpoint(step=step, saved_at=now_iso(), size_mb=round(size / 1_000_000, 1))
        run.job.checkpoints = [c for c in run.job.checkpoints if c.step != step] + [ckpt]
        _cb.save(run.job)
        _cb.updated(run.job)


def _finish(run: Run) -> None:
    job = run.job
    _read(run)
    if run.partial.strip():
        _line(run, run.partial)
        run.partial = ""
    _collect_checkpoints(run)
    code = run.proc.wait() if run.proc is not None else None
    if run.stopping:
        job.status = "stopped"
    elif run.ended or code == 0:
        job.status, job.step = "done", job.total
    else:
        job.status = "failed"
        job.error = logparse.error_line(list(run.tail)) or (
            f"lerobot-train exited with code {code}" if code is not None else "lerobot-train exited"
        )
    job.eta_s, job.steps_per_s = None, None
    with _lock:
        _runs.pop(job.id, None)
    _cb.save(job)
    _cb.updated(job)
    _cb.finished(job)

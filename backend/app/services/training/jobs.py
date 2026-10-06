"""Training jobs kept as folders under config.training_dir: local lerobot-train runs (local.py)
and RunPod pods (remote.py).

Each job folder holds job.yaml (the TrainJob plus the trainer's pid, or the RunPod extras),
train.log, metrics.jsonl and lerobot's output/. A local job waits (queued) while its GPU runs
another one; a RunPod job gets its own pod at once.
"""

import logging
import math
import shutil
import threading

from pydantic import ValidationError

from app.configs.config import config
from app.core import storage
from app.core.errors import ApiError, conflict, not_found
from app.core.events import bus
from app.models.models import Model
from app.models.training import Checkpoint, PodState, TrainJob
from app.schemas.training import (
    CheckpointPush,
    CheckpointPushed,
    CheckpointSave,
    CommandOut,
    CommandPreview,
    JobCreate,
    JobLog,
    LocalGpu,
    Metrics,
    RunPodConfig,
    TrainingConfig,
)
from app.services import datasets, models
from app.services.training import config as cfg
from app.services.training import local, params, remote
from app.services.training.plan import Plan
from app.utils import gpu
from app.utils.ids import next_seq_id, slugify
from app.utils.time import now_iso

log = logging.getLogger(__name__)

ACTIVE = ("running", "queued")
SERIES = ("loss_raw", "loss", "grad_norm", "lr", "update_s", "data_s", "gpu_util", "gpu_mem")
JOB_FILE = "job.yaml"

_jobs: dict[str, TrainJob] = {}
_gpu_index: dict[str, int] = {}  # job id → CUDA device index (local jobs)
_lock = threading.RLock()


def reset() -> None:
    """Reloads the job folders; running trainers are followed again, queued jobs start in turn."""
    local.reset()
    remote.reset()
    local.configure(local.Callbacks(save=_save, updated=_publish, metric=_metric, finished=_next))
    with _lock:
        _jobs.clear()
        _gpu_index.clear()
        root = config.training_dir
        for d in sorted(root.iterdir()) if root.is_dir() else []:
            raw = storage.read_file(d / JOB_FILE) if d.is_dir() else None
            if not isinstance(raw, dict):
                continue
            try:
                pid, index = raw.pop("pid", None), int(raw.pop("gpu_index", 0))
                extra = raw.pop("remote", None)
                job = TrainJob.model_validate(raw)
            except (ValidationError, ValueError) as e:
                log.warning("%s is not a usable training job, skipping it: %s", d, e)
                continue
            _jobs[job.id], _gpu_index[job.id] = job, index
            if job.status not in ACTIVE:
                continue
            if job.compute == "runpod":
                followed = remote.reattach(job, extra)
            else:
                followed = job.status == "queued" or local.reattach(job, pid, index, _log_freq(job))
            if not followed:
                job.status, job.eta_s, job.steps_per_s, job.phase = "failed", None, None, None
                job.error = "Trainer stopped while the backend was down"
                _save(job)
        queued = [j for j in _jobs.values() if j.status == "queued" and j.compute == "local"]
        for g in {_gpu_index[j.id] for j in queued}:
            _start_next(g)


# Storage and events


def _save(job: TrainJob) -> None:
    data = job.model_dump(mode="json", by_alias=False)
    data["pid"], data["gpu_index"] = local.pid_of(job.id), _gpu_index.get(job.id, 0)
    if job.compute == "runpod":
        data["remote"] = remote.extras(job.id)
    try:
        storage.write_file(local.job_dir(job.id) / JOB_FILE, storage.dumps(data))
    except OSError as e:
        log.warning("Could not write %s: %s", job.id, e)


def _publish(job: TrainJob) -> None:
    bus.publish("training.updated", job)


def _metric(job: TrainJob, step: int, values: dict[str, float]) -> None:
    bus.publish("training.metrics", {"jobId": job.id, "step": step, "values": values})


def _log_freq(job: TrainJob) -> int:
    return int(job.overrides.get("log_freq", params.DEFAULTS["log_freq"]))


# Config


def local_gpus() -> list[LocalGpu]:
    """GPUs reported by nvidia-smi; [] when none is detected."""
    out = []
    for g in gpu.detect():
        busy = _local_busy(g.name)
        out.append(LocalGpu(id=g.id, name=g.name, vram=g.vram, busy_by=busy.id if busy else None))
    return out


def _local_busy(gpu_name: str) -> TrainJob | None:
    return next(
        (
            j
            for j in list(_jobs.values())
            if j.compute == "local" and j.gpu == gpu_name and j.status == "running"
        ),
        None,
    )


def get_config() -> TrainingConfig:
    return TrainingConfig(
        policy=cfg.policy(),
        policy_base=cfg.policy_base(),
        local_gpus=local_gpus(),
        runpod=RunPodConfig(
            gpus=cfg.runpod_gpus(),
            regions=cfg.runpod_regions(),
            volumes=cfg.runpod_volumes(),
            price_factor=cfg.price_factor(),
            defaults=cfg.runpod_defaults(),
        ),
        param_groups=params.PARAM_GROUPS,
        trainable_datasets=cfg.trainable_datasets(),
    )


# Jobs


def _view(job: TrainJob) -> TrainJob:
    """The job as served: an idle pod's idleForS is counted now."""
    if job.pod_state and job.pod_state.state == "idle":
        job.pod_state.idle_for_s = remote.idle_for(job)
    return job


def list_jobs(status: str | None = None) -> list[TrainJob]:
    items = [_view(j) for j in list(_jobs.values()) if status is None or j.status == status]
    # Newest first: queued jobs have not started yet, so they lead
    return sorted(items, key=lambda j: (j.started_at or "9999", j.id), reverse=True)


def get_job(job_id: str) -> TrainJob:
    job = _jobs.get(job_id)
    if job is None:
        raise not_found("Training job", job_id)
    return _view(job)


def _run_paths(job: TrainJob) -> dict[str, str]:
    return {"output_dir": str(local.output_dir(job.id)), "job_name": job.id}


def _overrides(job: TrainJob) -> dict:
    return {**job.overrides, "steps": job.total, "batch_size": job.batch}


def job_log(job_id: str, tail: int) -> JobLog:
    get_job(job_id)
    lines, truncated = local.read_log(job_id, tail)
    return JobLog(lines=lines, truncated=truncated)


def job_command(job_id: str) -> CommandOut:
    job = get_job(job_id)
    return CommandOut(command=cfg.build_command(job.dataset, _overrides(job), _run_paths(job)))


def preview(body: JobCreate) -> CommandPreview:
    plan = Plan(body, local_gpus())
    out = CommandPreview(command=cfg.build_command(body.dataset, body.overrides))
    if (rate := plan.rate) is not None and plan.options is not None:
        cap = cfg.runpod_cap_hours(plan.options, rate)
        out.rate_per_hr = round(rate, 4)
        if cap:
            out.cap_hours = round(cap, 2)
            out.max_cost_usd = round(rate * cap, 2)
    return out


def create_job(body: JobCreate) -> TrainJob:
    """Local: starts lerobot-train, or queues the job while its GPU is busy. RunPod: rents a pod
    (remote.py); 424 when the RunPod key or the HF token is missing."""
    plan = Plan(body, local_gpus())
    ds = datasets.get_dataset(body.dataset)
    steps = int(body.overrides.get("steps", params.DEFAULTS["steps"]))
    batch = int(body.overrides.get("batch_size", params.DEFAULTS["batch_size"]))
    frames = datasets.total_frames(body.dataset)
    with _lock:
        job = TrainJob(
            id=next_seq_id("job", _existing_ids()),
            policy=cfg.policy(),
            dataset=body.dataset,
            task_id=ds.task_id if ds else "",
            compute=body.compute,
            gpu=plan.gpu_name,
            status="queued",
            step=0,
            total=steps,
            batch=batch,
            epoch=0,
            epochs=math.ceil(steps * batch / frames) if frames else 0,
            overrides=body.overrides,
        )
        if body.compute == "runpod":
            _start_remote(job, plan)
        else:
            _jobs[job.id], _gpu_index[job.id] = job, plan.gpu_index
            _save(job)
            if _local_busy(plan.gpu_name) is None:
                _start(job)
    _publish(job)
    return job


def _start_remote(job: TrainJob, plan: Plan) -> None:
    o = plan.options or cfg.runpod_defaults()
    rate = plan.rate or 0.0
    job.status, job.started_at, job.phase = "running", now_iso(), "pushing dataset"
    job.price_per_hr, job.cost_usd = round(rate, 4), 0.0
    remote.start(job, o, cfg.runpod_cap_hours(o, rate) if rate else o.max_hours)
    _jobs[job.id] = job
    _save(job)


def _existing_ids() -> list[str]:
    """Ids in memory and on disk, so a deleted folder's number is never reused."""
    root = config.training_dir
    on_disk = [p.name for p in root.iterdir()] if root.is_dir() else []
    return [*_jobs, *on_disk]


def _start(job: TrainJob) -> None:
    index = _gpu_index[job.id]
    argv = [*local.trainer_cmd(), *cfg.train_args(job.dataset, _overrides(job), _run_paths(job))]
    shutil.rmtree(local.output_dir(job.id), ignore_errors=True)
    try:
        local.start(job, argv, index, _log_freq(job))
    except OSError as e:
        job.status, job.error = "failed", f"Could not start lerobot-train: {e}"
    _save(job)


def _start_next(gpu_index: int) -> None:
    """Oldest queued job on that GPU, once nothing runs there."""
    with _lock:
        jobs = [j for j in _jobs.values() if _gpu_index.get(j.id) == gpu_index]
        if any(j.status == "running" for j in jobs):
            return
        queued = sorted((j for j in jobs if j.status == "queued"), key=lambda j: j.id)
        if queued:
            _start(queued[0])
            _publish(queued[0])


def _next(job: TrainJob) -> None:
    _start_next(_gpu_index.get(job.id, 0))


def stop_job(job_id: str) -> TrainJob:
    """A running job is sent SIGTERM and turns stopped once its process exits; a queued one at once."""
    job = get_job(job_id)
    if job.status not in ACTIVE:
        raise conflict(f"Job '{job_id}' is not active", status=job.status)
    if job.status == "running" and local.is_running(job_id):
        local.stop(job_id)
        return job
    if job.status == "running" and remote.stop(job_id):
        return job  # stopped once the pod reports it
    job.status, job.eta_s, job.steps_per_s = "stopped", None, None
    if job.pod_state and job.pod_state.state == "running":
        state = "terminated" if job.pod_state.auto_terminate else "idle"
        job.pod_state = PodState(
            state=state, auto_terminate=job.pod_state.auto_terminate, since=now_iso()
        )
    _save(job)
    _publish(job)
    return job


def terminate_pod(job_id: str) -> TrainJob:
    job = get_job(job_id)
    if job.pod_state is None:
        raise conflict(f"Job '{job_id}' has no pod")
    if job.pod_state.state == "terminated":
        raise conflict(f"Pod of job '{job_id}' is already terminated")
    if job.status in ACTIVE:
        raise conflict(f"Job '{job_id}' is still active; stop it first")
    remote.terminate(job)
    job.pod_state = PodState(
        state="terminated", auto_terminate=job.pod_state.auto_terminate, since=now_iso()
    )
    _save(job)
    _publish(job)
    return job


# Metrics


def metrics(job_id: str, from_step: int, max_points: int) -> Metrics:
    """Logged samples after from_step, averaged into at most max_points buckets.

    Bucket i covers `every` steps and sits at from_step + (i + 1) * every (the web's x axis).
    """
    job = get_job(job_id)
    freq = _log_freq(job)
    samples = [(s, v) for s, v in local.load_samples(job_id) if s > from_step]
    if not samples:
        empty = {k: [] for k in SERIES}
        return Metrics(from_step=from_step, to_step=from_step, every=freq, series=empty)
    per = math.ceil(len(samples) / max_points)
    series: dict[str, list[float]] = {k: [] for k in SERIES}
    for i in range(0, len(samples), per):
        chunk = [v for _, v in samples[i : i + per]]
        for k in SERIES:
            vals = [v[k] for v in chunk if k in v]
            prev = series[k][-1] if series[k] else 0.0
            series[k].append(round(sum(vals) / len(vals), 6) if vals else prev)
    return Metrics(from_step=from_step, to_step=samples[-1][0], every=per * freq, series=series)


# Checkpoints


def get_checkpoint(job_id: str, step: int) -> tuple[TrainJob, Checkpoint]:
    job = get_job(job_id)
    ckpt = next((c for c in job.checkpoints if c.step == step), None)
    if ckpt is None:
        raise not_found("Checkpoint", f"{job_id}@{step}")
    return job, ckpt


def download_checkpoint(job_id: str, step: int):
    get_checkpoint(job_id, step)
    raise ApiError(501, "Checkpoint download is not implemented yet")


def push_checkpoint(job_id: str, step: int, body: CheckpointPush | None = None) -> CheckpointPushed:
    job, _ = get_checkpoint(job_id, step)
    if not models.secret_set("hf_token"):
        raise ApiError(424, "Hugging Face token is not set")
    # Upload is not wired yet; report the target repo
    repo = body.repo if body else None
    return CheckpointPushed(repo=repo or models.default_repo(job.task_id))


def save_checkpoint(job_id: str, step: int, body: CheckpointSave) -> Model:
    """Copies the checkpoint's pretrained_model/ into a new models/<id>/ folder."""
    job, _ = get_checkpoint(job_id, step)
    src = local.checkpoint_dir(job_id, step) / "pretrained_model"
    if not src.is_dir():
        raise ApiError(410, "Checkpoint files are gone", {"path": str(src)})
    base = slugify(body.name) or f"{job_id}-{step}"
    model_id, n = base, 1
    while models.get_model(model_id) is not None or models.folder(model_id).exists():
        n += 1
        model_id = f"{base}-{n}"
    try:
        shutil.copytree(src, models.folder(model_id) / "pretrained_model")
    except OSError as e:
        shutil.rmtree(models.folder(model_id), ignore_errors=True)
        raise ApiError(503, "Could not write to the models folder", {"reason": str(e)}) from e
    model = Model(
        id=model_id,
        name=body.name.strip(),
        task_id=job.task_id,
        dataset=job.dataset,
        job_id=job.id,
        step=step,
        loss=_loss_at(job_id, step),
        size_mb=0,
        saved_at=now_iso(),
    )
    return models.reload(models.add_model(model).id)


def _loss_at(job_id: str, step: int) -> float:
    """Smoothed loss of the last sample at or before step (0 when none was logged)."""
    loss = 0.0
    for s, v in local.load_samples(job_id):
        if s > step:
            break
        loss = v.get("loss", v.get("loss_raw", loss))
    return round(loss, 4)

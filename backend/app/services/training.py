"""Training jobs (in memory, seeded from the web mocks). Jobs do not advance on their own yet."""

import math
import re

from app.utils.time import now_iso
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
    LocalGpu,
    Metrics,
    RunPodConfig,
    TrainingConfig,
)
from app.seeds.training import jobs as seed_jobs
from app.services import datasets
from app.services import models
from app.services import training_config as cfg
from app.services import training_params as params
from app.services.training_metrics import SERIES, Run, bucket
from app.services.training_plan import Plan

CHECKPOINT_MB = 1850
ACTIVE = ("running", "queued")

_jobs: dict[str, TrainJob] = {}
_runs: dict[str, Run] = {}


def _derive(job: TrainJob) -> None:
    """stepsPerS from the remaining steps and eta; costUsd so far for RunPod jobs."""
    if job.status == "running" and job.eta_s:
        job.steps_per_s = round((job.total - job.step) / job.eta_s, 3)
    if job.compute == "runpod" and job.price_per_hr is not None and job.elapsed_s is not None:
        job.cost_usd = round(job.price_per_hr * job.elapsed_s / 3600, 2)


def reset() -> None:
    _jobs.clear()
    _runs.clear()
    for job in seed_jobs():
        _derive(job)
        _jobs[job.id] = job


# Config


def local_gpus() -> list[LocalGpu]:
    gpus = [LocalGpu.model_validate(g) for g in cfg.raw("LOCAL_GPUS")]
    for g in gpus:
        busy = _local_busy(g.name)
        g.busy_by = busy.id if busy else None
    return gpus


def _local_busy(gpu_name: str) -> TrainJob | None:
    return next(
        (
            j
            for j in _jobs.values()
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


def list_jobs(status: str | None = None) -> list[TrainJob]:
    items = [j for j in _jobs.values() if status is None or j.status == status]
    # Newest first: queued jobs have not started yet, so they lead
    return sorted(items, key=lambda j: (j.started_at or "9999", j.id), reverse=True)


def get_job(job_id: str) -> TrainJob:
    job = _jobs.get(job_id)
    if job is None:
        raise not_found("Training job", job_id)
    return job


def job_command(job_id: str) -> CommandOut:
    job = get_job(job_id)
    # Seed jobs carry steps / batch as fields only
    overrides = {"steps": job.total, "batch_size": job.batch, **job.overrides}
    return CommandOut(command=cfg.build_command(job.dataset, overrides))


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


def _secret_set(name: str) -> bool:
    return models.secret_set(name)


def _next_id() -> str:
    n = max((int(m.group(1)) for j in _jobs if (m := re.fullmatch(r"job_(\d+)", j))), default=0)
    return f"job_{n + 1:03d}"


def _epochs(dataset: str, steps: int, batch: int) -> int:
    frames = sum(e.frames for e in datasets.dataset_episodes(dataset))
    return max(1, math.ceil(steps * batch / frames)) if frames else 1


def create_job(body: JobCreate) -> TrainJob:
    plan = Plan(body, local_gpus())
    if body.compute == "runpod" and not _secret_set("runpod_api_key"):
        raise ApiError(424, "RunPod API key is not set")
    total = int(body.overrides.get("steps", params.DEFAULTS["steps"]))
    batch = int(body.overrides.get("batch_size", params.DEFAULTS["batch_size"]))
    queued = body.compute == "local" and _local_busy(plan.gpu_name) is not None
    job_id = _next_id()
    job = TrainJob(
        id=job_id,
        policy=cfg.policy(),
        dataset=body.dataset,
        task_id=datasets.get_dataset(body.dataset).task_id,
        compute=body.compute,
        gpu=plan.gpu_name,
        status="queued" if queued else "running",
        step=0,
        total=total,
        batch=batch,
        epoch=0,
        epochs=_epochs(body.dataset, total, batch),
        overrides=dict(body.overrides),
    )
    if not queued:
        _start(job)
    if plan.options is not None:
        job.price_per_hr = round(plan.rate, 4)
        slug = re.sub(r"[^a-z0-9]+", "", plan.gpu_name.lower().split()[-1])
        job.pod = f"pod-{slug}-{job_id.split('_')[1]}"
        job.pod_state = PodState(
            state="running", auto_terminate=plan.options.terminate_on_finish, since=now_iso()
        )
        _derive(job)
    _jobs[job.id] = job
    bus.publish("training.updated", job)
    return job


def _start(job: TrainJob) -> None:
    job.status, job.started_at, job.elapsed_s = "running", now_iso(), 0


def stop_job(job_id: str) -> TrainJob:
    job = get_job(job_id)
    if job.status not in ACTIVE:
        raise conflict(f"Job '{job_id}' is not active", status=job.status)
    was_running = job.status == "running"
    job.status, job.eta_s, job.steps_per_s = "stopped", None, None
    if was_running and job.step > 0 and all(c.step != job.step for c in job.checkpoints):
        job.checkpoints.append(Checkpoint(step=job.step, saved_at=now_iso(), size_mb=CHECKPOINT_MB))
    if job.pod_state and job.pod_state.state == "running":
        state = "terminated" if job.pod_state.auto_terminate else "idle"
        job.pod_state = PodState(
            state=state, auto_terminate=job.pod_state.auto_terminate, since=now_iso()
        )
    bus.publish("training.updated", job)
    if was_running and job.compute == "local":
        _start_next_local(job.gpu)
    return job


def _start_next_local(gpu_name: str) -> None:
    waiting = sorted(
        (
            j
            for j in _jobs.values()
            if j.compute == "local" and j.gpu == gpu_name and j.status == "queued"
        ),
        key=lambda j: j.id,
    )
    if waiting:
        _start(waiting[0])
        bus.publish("training.updated", waiting[0])


def terminate_pod(job_id: str) -> TrainJob:
    job = get_job(job_id)
    if job.pod_state is None:
        raise conflict(f"Job '{job_id}' has no pod")
    if job.pod_state.state == "terminated":
        raise conflict(f"Pod of job '{job_id}' is already terminated")
    if job.status in ACTIVE:
        raise conflict(f"Job '{job_id}' is still active; stop it first")
    job.pod_state = PodState(
        state="terminated", auto_terminate=job.pod_state.auto_terminate, since=now_iso()
    )
    bus.publish("training.updated", job)
    return job


# Metrics


def _run(job: TrainJob) -> Run:
    run = _runs.get(job.id)
    if run is None or run.total != job.total:
        run = _runs[job.id] = Run(job.id, job.gpu, job.total)
    run.advance_to(job.step)
    return run


def metrics(job_id: str, from_step: int, max_points: int) -> Metrics:
    job = get_job(job_id)
    run = _run(job)
    start = min(from_step, run.count)
    n = run.count - start
    every = max(1, math.ceil(n / max_points))
    series = {k: bucket(run.data[k][start:], every) for k in SERIES}
    return Metrics(from_step=start, to_step=run.count, every=every, series=series)


def loss_at(job: TrainJob, step: int) -> float:
    run = _run(job)
    run.advance_to(step)
    return round(run.data["loss"][max(0, min(step, run.count) - 1)], 4) if run.count else 0.0


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
    if not _secret_set("hf_token"):
        raise ApiError(424, "Hugging Face token is not set")
    # Upload is not wired yet; report the target repo
    repo = body.repo if body else None
    return CheckpointPushed(repo=repo or models.default_repo(job.task_id))


def save_checkpoint(job_id: str, step: int, body: CheckpointSave) -> Model:
    job, ckpt = get_checkpoint(job_id, step)
    model_id = f"m-{job.id}-{step:06d}"
    if models.get_model(model_id) is not None:
        raise conflict(f"Checkpoint {step} of '{job_id}' is already saved", modelId=model_id)
    model = Model(
        id=model_id,
        name=body.name.strip(),
        task_id=job.task_id,
        dataset=job.dataset,
        job_id=job.id,
        step=step,
        loss=loss_at(job, step),
        size_mb=ckpt.size_mb,
        saved_at=now_iso(),
        local_path=f"~/vla/models/{job.task_id}/{job.id}-{step:06d}",
    )
    return models.add_model(model)


reset()

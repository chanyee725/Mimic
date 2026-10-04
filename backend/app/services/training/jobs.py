"""Training jobs (in memory, no mocks). No trainer is connected yet, so no job can start.

Config, parameter checks and the command preview are real; jobs, metrics and checkpoints
stay empty until a trainer (local lerobot-train or RunPod) reports them.
"""

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
from app.services import models
from app.services.training import config as cfg
from app.services.training import params
from app.services.training.plan import Plan
from app.utils import gpu
from app.utils.time import now_iso

ACTIVE = ("running", "queued")
SERIES = ("loss_raw", "loss", "grad_norm", "lr", "update_s", "data_s", "gpu_util", "gpu_mem")
NOT_CONNECTED = "Trainer is not connected yet"

_jobs: dict[str, TrainJob] = {}


def reset() -> None:
    _jobs.clear()


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


def create_job(body: JobCreate) -> TrainJob:
    """Refused until a trainer is connected (no simulated progress)."""
    raise ApiError(503, NOT_CONNECTED, {"compute": body.compute})


def stop_job(job_id: str) -> TrainJob:
    job = get_job(job_id)
    if job.status not in ACTIVE:
        raise conflict(f"Job '{job_id}' is not active", status=job.status)
    job.status, job.eta_s, job.steps_per_s = "stopped", None, None
    if job.pod_state and job.pod_state.state == "running":
        state = "terminated" if job.pod_state.auto_terminate else "idle"
        job.pod_state = PodState(
            state=state, auto_terminate=job.pod_state.auto_terminate, since=now_iso()
        )
    bus.publish("training.updated", job)
    return job


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


def metrics(job_id: str, from_step: int, max_points: int) -> Metrics:
    """Logged training metrics; empty until the trainer reports step logs."""
    get_job(job_id)
    return Metrics(from_step=from_step, to_step=from_step, every=1, series={k: [] for k in SERIES})


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
    """Copies a checkpoint into the models folder; needs the trainer's files."""
    get_checkpoint(job_id, step)
    raise ApiError(503, NOT_CONNECTED)

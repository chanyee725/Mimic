"""Training jobs (in memory, seeded from the web mocks). Jobs do not advance on their own yet."""

import math
import re

from app.core.clock import iso, now_iso
from app.core.errors import ApiError, conflict, not_found
from app.core.events import bus
from app.core.seed import load
from app.datasets import service as datasets
from app.models import service as models
from app.models.schemas import Model
from app.training import params
from app.training.metrics import SERIES, Run, bucket
from app.training.schemas import (
    Checkpoint,
    CommandPreview,
    JobCreate,
    LocalGpu,
    Metrics,
    PodState,
    PriceFactor,
    RunPodConfig,
    RunPodGpu,
    RunPodOptions,
    RunPodVolume,
    TrainingConfig,
    TrainJob,
)

CHECKPOINT_MB = 1850
ACTIVE = ("running", "queued")

_jobs: dict[str, TrainJob] = {}
_runs: dict[str, Run] = {}


def parse_duration(text: str | None) -> int | None:
    """ "2h 08m" / "58m" / "15h 49m" → seconds."""
    if not text:
        return None
    parts = dict((u, int(n)) for n, u in re.findall(r"(\d+)\s*([hms])", text))
    return parts.get("h", 0) * 3600 + parts.get("m", 0) * 60 + parts.get("s", 0)


def _seed_job(j: dict) -> TrainJob:
    j["elapsedS"] = parse_duration(j.pop("elapsed", None))
    j["etaS"] = parse_duration(j.pop("eta", None))
    if j.get("startedAt"):
        j["startedAt"] = iso(j["startedAt"])
    if pod := j.get("podState"):
        pod["idleForS"] = parse_duration(pod.pop("idleFor", None))
        if pod.get("since"):
            pod["since"] = iso(pod["since"])
    for c in j["checkpoints"]:
        c["savedAt"] = iso(c["savedAt"])
    j["overrides"] = {}
    job = TrainJob.model_validate(j)
    _derive(job)
    return job


def _derive(job: TrainJob) -> None:
    """stepsPerS from the remaining steps and eta; costUsd so far for RunPod jobs."""
    if job.status == "running" and job.eta_s:
        job.steps_per_s = round((job.total - job.step) / job.eta_s, 3)
    if job.compute == "runpod" and job.price_per_hr is not None and job.elapsed_s is not None:
        job.cost_usd = round(job.price_per_hr * job.elapsed_s / 3600, 2)


def reset() -> None:
    _jobs.clear()
    _runs.clear()
    for j in load("training", "JOBS"):
        job = _seed_job(j)
        _jobs[job.id] = job


# Config


def _raw(key: str):
    return load("training", key)


def runpod_gpus() -> list[RunPodGpu]:
    return [RunPodGpu.model_validate(g) for g in _raw("RUNPOD_GPUS")]


def price_factor() -> PriceFactor:
    return PriceFactor.model_validate(_raw("RUNPOD_PRICE_FACTOR"))


def local_gpus() -> list[LocalGpu]:
    gpus = [LocalGpu.model_validate(g) for g in _raw("LOCAL_GPUS")]
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


def trainable_datasets() -> list[str]:
    return [
        d.repo_id for d in datasets.list_datasets() if d.kind == "lerobot" and d.status == "ready"
    ]


def get_config() -> TrainingConfig:
    return TrainingConfig(
        policy=_raw("POLICY"),
        policy_base=_raw("POLICY_BASE"),
        local_gpus=local_gpus(),
        runpod=RunPodConfig(
            gpus=runpod_gpus(),
            regions=_raw("RUNPOD_REGIONS"),
            volumes=[RunPodVolume.model_validate(v) for v in _raw("RUNPOD_VOLUMES")],
            price_factor=price_factor(),
            defaults=RunPodOptions.model_validate(_raw("RUNPOD_DEFAULTS")),
        ),
        param_groups=params.PARAM_GROUPS,
        trainable_datasets=trainable_datasets(),
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


def _invalid(msg: str, *loc: str) -> ApiError:
    return ApiError(422, msg, {"errors": [{"loc": ["body", *loc], "msg": msg}]})


def runpod_rate(base: float, o: RunPodOptions) -> float:
    f = price_factor()
    return base * o.gpu_count * f.cloud[o.cloud] * f.pricing[o.pricing]


def runpod_cap_hours(o: RunPodOptions, rate: float) -> float:
    """Hours until the max runtime or the budget is hit (0 = no limit)."""
    if o.budget:
        return min(o.max_hours or math.inf, o.budget / rate)
    return o.max_hours


class _Plan:
    """A validated POST /training/jobs body."""

    def __init__(self, body: JobCreate) -> None:
        if body.dataset not in trainable_datasets():
            raise _invalid("Dataset is not a ready LeRobot dataset", "dataset")
        if errors := params.check_overrides(body.overrides):
            raise ApiError(422, "Unknown or invalid training parameters", {"errors": errors})
        self.body = body
        self.options: RunPodOptions | None = None
        self.base_price: float | None = None
        if body.compute == "local":
            gpu = next((g for g in local_gpus() if body.gpu in (g.id, g.name)), None)
            if gpu is None:
                raise _invalid("Unknown local GPU", "gpu")
            self.gpu_name = gpu.name
            return
        rp = next((g for g in runpod_gpus() if g.name == body.gpu), None)
        if rp is None:
            raise _invalid("Unknown RunPod GPU", "gpu")
        if rp.stock == "none":
            raise conflict(f"RunPod GPU '{rp.name}' is out of stock")
        o = body.runpod or RunPodOptions.model_validate(_raw("RUNPOD_DEFAULTS"))
        if o.cloud == "community" and not rp.community:
            raise _invalid("GPU is not offered on the community cloud", "runpod", "cloud")
        if o.region not in _raw("RUNPOD_REGIONS"):
            raise _invalid("Unknown RunPod region", "runpod", "region")
        if o.volume not in {v["id"] for v in _raw("RUNPOD_VOLUMES")}:
            raise _invalid("Unknown RunPod volume", "runpod", "volume")
        self.gpu_name, self.options, self.base_price = rp.name, o, rp.price_per_hr

    @property
    def rate(self) -> float | None:
        if self.options is None or self.base_price is None:
            return None
        return runpod_rate(self.base_price, self.options)


def build_command(dataset: str, overrides: dict) -> str:
    flags = params.override_flags(overrides)
    head = [
        "lerobot-train",
        f"--policy.path={_raw('POLICY_BASE')}",
        f"--dataset.repo_id={dataset}",
        "--policy.device=cuda",
    ]
    return " ".join(head + flags)


def job_command(job_id: str) -> str:
    job = get_job(job_id)
    # Seed jobs carry steps / batch as fields only
    return build_command(
        job.dataset, {"steps": job.total, "batch_size": job.batch, **job.overrides}
    )


def preview(body: JobCreate) -> CommandPreview:
    plan = _Plan(body)
    out = CommandPreview(command=build_command(body.dataset, body.overrides))
    if (rate := plan.rate) is not None and plan.options is not None:
        cap = runpod_cap_hours(plan.options, rate)
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
    plan = _Plan(body)
    if body.compute == "runpod" and not _secret_set("runpod_api_key"):
        raise ApiError(424, "RunPod API key is not set")
    total = int(body.overrides.get("steps", params.DEFAULTS["steps"]))
    batch = int(body.overrides.get("batch_size", params.DEFAULTS["batch_size"]))
    queued = body.compute == "local" and _local_busy(plan.gpu_name) is not None
    job_id = _next_id()
    job = TrainJob(
        id=job_id,
        policy=_raw("POLICY"),
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


def push_checkpoint(job_id: str, step: int, repo: str | None) -> str:
    job, _ = get_checkpoint(job_id, step)
    if not _secret_set("hf_token"):
        raise ApiError(424, "Hugging Face token is not set")
    # Upload is not wired yet; report the target repo
    return repo or models.default_repo(job.task_id)


def save_checkpoint(job_id: str, step: int, name: str) -> Model:
    job, ckpt = get_checkpoint(job_id, step)
    model_id = f"m-{job.id}-{step:06d}"
    if models.get_model(model_id) is not None:
        raise conflict(f"Checkpoint {step} of '{job_id}' is already saved", modelId=model_id)
    model = Model(
        id=model_id,
        name=name.strip(),
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

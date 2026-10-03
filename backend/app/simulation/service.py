"""Simulation state: scanned environments and evaluation jobs (in memory)."""

import random
import threading

from app.core.clock import now_iso
from app.core.config import config
from app.core.errors import ApiError, conflict, not_found
from app.core.events import bus
from app.models.service import get_model, list_models
from app.models.schemas import Model
from app.rigs.service import get_rig
from app.simulation.scanner import scan_envs
from app.simulation.schemas import (
    CompatIssue,
    ModelCompat,
    RescanResult,
    SimConfig,
    SimEnv,
    SimEpisode,
    SimEpisodeEvent,
    SimJob,
    SimJobCreate,
)
from app.simulation.seed import counts, seed_gpu, seed_jobs
from app.tasks.service import get_task

ACTIVE = ("running", "queued")
# Mock rollout outcomes used by advance() until Isaac Sim is wired in
_SUCCESS_P = {"none": 0.85, "low": 0.75, "high": 0.6}
_REASONS = ["Timed out", "Dropped object", "Wrong placement", "Grasp slipped"]

_lock = threading.RLock()
_first_seen: dict[str, str] = {}
_envs: dict[str, SimEnv] = {}
_jobs: dict[str, SimJob] = {}
_episodes: dict[str, list[SimEpisode]] = {}


def reset() -> None:
    with _lock:
        _first_seen.clear()
        _jobs.clear()
        _episodes.clear()
        jobs, episodes = seed_jobs()
        _jobs.update({j.id: j for j in jobs})
        _episodes.update(episodes)
        _scan()


# Environments


def _scan() -> list[SimEnv]:
    envs = scan_envs(config.sim_envs_dir, _first_seen)
    for e in envs:
        _first_seen.setdefault(e.id, e.registered_at)
    _envs.clear()
    _envs.update({e.id: e for e in envs})
    return envs


def list_envs(state: str | None = None) -> list[SimEnv]:
    return [e for e in _envs.values() if state is None or e.state == state]


def get_env(env_id: str) -> SimEnv:
    env = _envs.get(env_id)
    if env is None:
        raise not_found("Environment", env_id)
    return env


def rescan() -> RescanResult:
    with _lock:
        envs = _scan()
    bus.publish("sim.envs", {"envs": [e.model_dump(by_alias=True, mode="json") for e in envs]})
    return RescanResult(dir=str(config.sim_envs_dir), scanned_at=now_iso(), envs=envs)


def model_spec(model: Model) -> tuple[list[str], int]:
    """Cameras and action size a model expects, from its task and rig."""
    task = get_task(model.task_id)
    rig = get_rig(task.rig_id) if task else None
    return (list(task.cameras) if task else []), (len(rig.joints) if rig else 0)


def env_compat(env: SimEnv, cameras: list[str], action_dim: int) -> list[CompatIssue]:
    """Same rules as web/src/domain/simulation.ts#envCompat."""
    issues: list[CompatIssue] = []
    if env.state != "ready":
        issues.append(CompatIssue(level="error", text=env.error or "Environment failed to load"))
    missing = [c for c in cameras if c not in env.cameras]
    if missing:
        issues.append(CompatIssue(level="error", text=f"Missing camera {', '.join(missing)}"))
    if env.action_dim != action_dim:
        text = f"Action size {env.action_dim}, model expects {action_dim}"
        issues.append(CompatIssue(level="error", text=text))
    if not env.calibrated:
        issues.append(CompatIssue(level="warn", text="Not matched to the real rig"))
    return issues


def _compat(env: SimEnv, model: Model) -> ModelCompat:
    issues = env_compat(env, *model_spec(model))
    usable = not any(i.level == "error" for i in issues)
    return ModelCompat(model_id=model.id, usable=usable, issues=issues)


def compat(env_id: str) -> list[ModelCompat]:
    """Every saved model: usable for the env's task first, other usable ones, then blocked."""
    env = get_env(env_id)
    models = {m.id: m for m in list_models()}
    rows = [_compat(env, m) for m in models.values()]
    rank = lambda c: 2 if not c.usable else 0 if models[c.model_id].task_id == env.task_id else 1
    return sorted(rows, key=rank)


def sim_config() -> SimConfig:
    gpu = seed_gpu()
    running = next((j for j in _jobs.values() if j.status == "running"), None)
    gpu.busy_by = running.id if running else None
    return SimConfig(envs_dir=str(config.sim_envs_dir), gpu=gpu)


# Jobs


def _num(job_id: str) -> int:
    tail = job_id.rsplit("_", 1)[-1]
    return int(tail) if tail.isdigit() else 0


def list_jobs(status: str | None = None) -> list[SimJob]:
    jobs = [j for j in _jobs.values() if status is None or j.status == status]
    return sorted(jobs, key=lambda j: _num(j.id), reverse=True)


def get_job(job_id: str) -> SimJob:
    job = _jobs.get(job_id)
    if job is None:
        raise not_found("Simulation job", job_id)
    return job


def create_job(body: SimJobCreate) -> SimJob:
    with _lock:
        model = get_model(body.model_id)
        if model is None:
            raise ApiError(422, f"Model '{body.model_id}' does not exist")
        env = _envs.get(body.env_id)
        if env is None:
            raise ApiError(422, f"Environment '{body.env_id}' does not exist")
        issues = _compat(env, model).issues
        if any(i.level == "error" for i in issues):
            raise ApiError(
                422,
                f"Model '{model.id}' cannot be loaded into '{env.id}'",
                {"issues": [i.model_dump(mode="json") for i in issues]},
            )
        busy = any(j.status == "running" for j in _jobs.values())
        job = SimJob(
            id=f"sim_{max((_num(i) for i in _jobs), default=0) + 1:03d}",
            **body.model_dump(),
            status="queued" if busy else "running",
        )
        if not busy:
            _start(job)
        _jobs[job.id] = job
        _episodes[job.id] = []
    bus.publish("sim.updated", job)
    return job


def stop_job(job_id: str) -> SimJob:
    with _lock:
        job = get_job(job_id)
        if job.status not in ACTIVE:
            raise conflict(f"Simulation job '{job_id}' is {job.status}", status=job.status)
        job.status = "stopped"
        job.eta_s = None
        promoted = _promote()
    bus.publish("sim.updated", job)
    if promoted:
        bus.publish("sim.updated", promoted)
    return job


def list_episodes(job_id: str, result: str | None = None) -> list[SimEpisode]:
    get_job(job_id)
    eps = _episodes.get(job_id, [])
    if result is not None:
        eps = [e for e in eps if e.success == (result == "success")]
    return eps


def get_episode(job_id: str, index: int) -> SimEpisode:
    eps = _episodes.get(get_job(job_id).id, [])
    if not 0 <= index < len(eps):
        raise not_found("Episode", f"{job_id}/{index}")
    return eps[index]


def advance(job_id: str, n: int = 1) -> SimJob:
    """Finish up to n more episodes of a running job with deterministic mock outcomes."""
    with _lock:
        job = get_job(job_id)
        if job.status != "running":
            raise conflict(f"Simulation job '{job_id}' is {job.status}", status=job.status)
        eps = _episodes.setdefault(job.id, [])
        new = [_rollout(job, len(eps) + i) for i in range(min(n, job.episodes - len(eps)))]
        eps.extend(new)
        job.elapsed_s = (job.elapsed_s or 0) + sum(e.seconds for e in new)
        for k, v in counts(eps).items():
            setattr(job, k, v)
        promoted = None
        if job.done >= job.episodes:
            job.status, job.eta_s = "done", None
            promoted = _promote()
        elif job.done:
            job.eta_s = round(job.elapsed_s / job.done * (job.episodes - job.done))
    for e in new:
        bus.publish("sim.episode", SimEpisodeEvent(job_id=job.id, episode=e))
    bus.publish("sim.updated", job)
    if promoted:
        bus.publish("sim.updated", promoted)
    return job


def _rollout(job: SimJob, index: int) -> SimEpisode:
    seed = job.seed_start + index
    rng = random.Random(seed)
    if rng.random() < _SUCCESS_P[job.randomization]:
        return SimEpisode(index=index, seed=seed, success=True, seconds=_secs(rng, job))
    reason = rng.choice(_REASONS)
    seconds = job.max_seconds if reason == "Timed out" else _secs(rng, job)
    return SimEpisode(index=index, seed=seed, success=False, seconds=seconds, reason=reason)


def _secs(rng: random.Random, job: SimJob) -> float:
    return round(rng.uniform(0.4, 0.9) * job.max_seconds, 1)


def _start(job: SimJob) -> None:
    job.status = "running"
    job.started_at = now_iso()
    job.elapsed_s = 0


def _promote() -> SimJob | None:
    """Start the oldest queued job once the GPU is free."""
    if any(j.status == "running" for j in _jobs.values()):
        return None
    queued = [j for j in _jobs.values() if j.status == "queued"]
    if not queued:
        return None
    job = min(queued, key=lambda j: _num(j.id))
    _start(job)
    return job


reset()

"""Simulation evaluation jobs (in memory); advance() finishes episodes until Isaac Sim is wired in."""

import random

from app.configs.config import config
from app.core.errors import ApiError, conflict, not_found
from app.core.events import bus
from app.models.simulation import SimConfig, SimEpisode, SimJob
from app.schemas.common import Page, paginate
from app.schemas.simulation import SimEpisodeEvent, SimJobCreate
from app.seeds.simulation import counts, seed_gpu, seed_jobs
from app.services.models import get_model
from app.services.simulation.envs import find_env, get_env, lock, model_compat
from app.utils.ids import seq_num
from app.utils.time import now_iso

ACTIVE = ("running", "queued")
# Mock rollout outcomes used by advance() until Isaac Sim is wired in
_SUCCESS_P = {"none": 0.85, "low": 0.75, "high": 0.6}
_REASONS = ["Timed out", "Dropped object", "Wrong placement", "Grasp slipped"]

_jobs: dict[str, SimJob] = {}
_episodes: dict[str, list[SimEpisode]] = {}


def reset() -> None:
    with lock:
        _jobs.clear()
        _episodes.clear()
        jobs, episodes = seed_jobs()
        _jobs.update({j.id: j for j in jobs})
        _episodes.update(episodes)


def sim_config() -> SimConfig:
    gpu = seed_gpu()
    running = next((j for j in _jobs.values() if j.status == "running"), None)
    gpu.busy_by = running.id if running else None
    return SimConfig(envs_dir=str(config.sim_envs_dir), gpu=gpu)


# Jobs


def list_jobs(status: str | None = None) -> list[SimJob]:
    jobs = [j for j in _jobs.values() if status is None or j.status == status]
    return sorted(jobs, key=lambda j: seq_num(j.id), reverse=True)


def get_job(job_id: str) -> SimJob:
    job = _jobs.get(job_id)
    if job is None:
        raise not_found("Simulation job", job_id)
    return job


def create_job(body: SimJobCreate) -> SimJob:
    with lock:
        model = get_model(body.model_id)
        if model is None:
            raise ApiError(422, f"Model '{body.model_id}' does not exist")
        env = find_env(body.env_id)
        if env is None:
            raise ApiError(422, f"Environment '{body.env_id}' does not exist")
        issues = model_compat(env, model).issues
        if any(i.level == "error" for i in issues):
            raise ApiError(
                422,
                f"Model '{model.id}' cannot be loaded into '{env.id}'",
                {"issues": [i.model_dump(mode="json") for i in issues]},
            )
        busy = any(j.status == "running" for j in _jobs.values())
        job = SimJob(
            id=f"sim_{max((seq_num(i) for i in _jobs), default=0) + 1:03d}",
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
    with lock:
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


def page_episodes(
    job_id: str, result: str | None, limit: int, cursor: str | None
) -> Page[SimEpisode]:
    return paginate(list_episodes(job_id, result), limit, cursor)


def episode_video(job_id: str, index: int, camera: str) -> bytes:
    """Rollout video of one episode camera; always refused until Isaac Sim is connected."""
    get_episode(job_id, index)
    if camera not in get_env(get_job(job_id).env_id).cameras:
        raise ApiError(404, f"Camera '{camera}' is not rendered by this environment")
    raise ApiError(501, "Rollout video is not available until Isaac Sim is connected")


def advance(job_id: str, n: int = 1) -> SimJob:
    """Finish up to n more episodes of a running job with deterministic mock outcomes."""
    with lock:
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
    job = min(queued, key=lambda j: seq_num(j.id))
    _start(job)
    return job

"""Simulation evaluation jobs (in memory, no mocks). The Isaac Sim runner is not connected yet,
so a valid request is refused with 503 and the job list stays empty.
"""

from app.configs.config import config
from app.core.errors import ApiError, conflict, not_found
from app.core.events import bus
from app.models.simulation import SimConfig, SimEpisode, SimGpu, SimJob
from app.schemas.common import Page, paginate
from app.schemas.simulation import SimJobCreate
from app.services.models import get_model
from app.services.simulation.envs import find_env, get_env, lock, model_compat
from app.utils import gpu
from app.utils.ids import seq_num

ACTIVE = ("running", "queued")
NOT_CONNECTED = "Isaac Sim runner is not connected"

_jobs: dict[str, SimJob] = {}
_episodes: dict[str, list[SimEpisode]] = {}


def reset() -> None:
    with lock:
        _jobs.clear()
        _episodes.clear()


def sim_config() -> SimConfig:
    """Environments folder and the first local GPU (null when nvidia-smi finds none)."""
    found = gpu.detect()
    sim_gpu = None
    if found:
        g = found[0]
        running = next((j for j in _jobs.values() if j.status == "running"), None)
        sim_gpu = SimGpu(id=g.id, name=g.name, vram=g.vram, busy_by=running.id if running else None)
    return SimConfig(envs_dir=str(config.sim_envs_dir), gpu=sim_gpu)


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
    """Validates the model and environment; refused with 503 until the runner is connected."""
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
    raise ApiError(503, NOT_CONNECTED, {"envId": env.id, "modelId": model.id})


def stop_job(job_id: str) -> SimJob:
    with lock:
        job = get_job(job_id)
        if job.status not in ACTIVE:
            raise conflict(f"Simulation job '{job_id}' is {job.status}", status=job.status)
        job.status = "stopped"
        job.eta_s = None
    bus.publish("sim.updated", job)
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

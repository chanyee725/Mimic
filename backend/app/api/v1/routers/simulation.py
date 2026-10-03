"""Simulation endpoints — see docs/api/simulation.md."""

from fastapi import APIRouter, Query

from app.models.simulation import (
    EpisodeResult,
    SimConfig,
    SimEnv,
    SimEnvState,
    SimEpisode,
    SimJob,
    SimJobStatus,
)
from app.schemas.common import Page
from app.schemas.simulation import ModelCompat, RescanResult, SimJobCreate
from app.services import simulation as service

router = APIRouter(prefix="/sim", tags=["simulation"])


@router.get("/envs", response_model=list[SimEnv])
def list_envs(state: SimEnvState | None = None):
    return service.list_envs(state)


@router.post("/envs/rescan", response_model=RescanResult)
def rescan():
    return service.rescan()


@router.get("/envs/{env_id}", response_model=SimEnv)
def get_env(env_id: str):
    return service.get_env(env_id)


@router.get("/envs/{env_id}/compat", response_model=list[ModelCompat])
def env_compat(env_id: str):
    return service.compat(env_id)


@router.get("/config", response_model=SimConfig)
def sim_config():
    return service.sim_config()


@router.get("/jobs", response_model=list[SimJob])
def list_jobs(status: SimJobStatus | None = None):
    return service.list_jobs(status)


@router.post("/jobs", response_model=SimJob, status_code=202)
def create_job(body: SimJobCreate):
    return service.create_job(body)


@router.get("/jobs/{job_id}", response_model=SimJob)
def get_job(job_id: str):
    return service.get_job(job_id)


@router.post("/jobs/{job_id}/stop", response_model=SimJob)
def stop_job(job_id: str):
    return service.stop_job(job_id)


@router.get("/jobs/{job_id}/episodes", response_model=Page[SimEpisode])
def list_episodes(
    job_id: str,
    result: EpisodeResult | None = None,
    limit: int = Query(50, ge=1, le=500),
    cursor: str | None = None,
):
    return service.page_episodes(job_id, result, limit, cursor)


@router.get("/jobs/{job_id}/episodes/{index}/video/{camera}")
def episode_video(job_id: str, index: int, camera: str):
    return service.episode_video(job_id, index, camera)

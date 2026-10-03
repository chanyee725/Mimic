"""Simulation evaluation jobs and their episodes."""

from fastapi import APIRouter

from app.api.deps import Pagination
from app.models.simulation import EpisodeResult, SimEpisode, SimJob, SimJobStatus
from app.schemas.common import Page
from app.schemas.simulation import SimJobCreate
from app.services import simulation as service

router = APIRouter()


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
def list_episodes(job_id: str, page: Pagination, result: EpisodeResult | None = None):
    return service.page_episodes(job_id, result, page.limit, page.cursor)


@router.get("/jobs/{job_id}/episodes/{index}/video/{camera}")
def episode_video(job_id: str, index: int, camera: str):
    return service.episode_video(job_id, index, camera)

"""Training jobs: create, stop, pod teardown, metrics and command."""

from fastapi import APIRouter, Query

from app.models.training import JobStatus, TrainJob
from app.schemas.training import CommandOut, JobCreate, JobLog, Metrics
from app.services import training as service

router = APIRouter()


@router.get("/jobs", response_model=list[TrainJob])
def list_jobs(status: JobStatus | None = None):
    return service.list_jobs(status)


@router.post("/jobs", response_model=TrainJob, status_code=202)
def create_job(body: JobCreate):
    return service.create_job(body)


@router.get("/jobs/{job_id}", response_model=TrainJob)
def get_job(job_id: str):
    return service.get_job(job_id)


@router.post("/jobs/{job_id}/stop", response_model=TrainJob)
def stop_job(job_id: str):
    return service.stop_job(job_id)


@router.post("/jobs/{job_id}/pod/terminate", response_model=TrainJob)
def terminate_pod(job_id: str):
    return service.terminate_pod(job_id)


@router.get("/jobs/{job_id}/metrics", response_model=Metrics)
def job_metrics(
    job_id: str,
    from_step: int = Query(0, alias="fromStep", ge=0),
    max_points: int = Query(2000, alias="maxPoints", ge=1, le=20000),
):
    return service.metrics(job_id, from_step, max_points)


@router.get("/jobs/{job_id}/log", response_model=JobLog)
def job_log(job_id: str, tail: int = Query(500, ge=1, le=5000)):
    return service.job_log(job_id, tail)


@router.get("/jobs/{job_id}/command", response_model=CommandOut)
def job_command(job_id: str):
    return service.job_command(job_id)

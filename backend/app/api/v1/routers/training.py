"""Training endpoints — see docs/api/training.md."""

from fastapi import APIRouter, Query

from app.core.errors import ApiError
from app.schemas.models import Model
from app.services import training as service
from app.schemas.training import (
    CheckpointPush,
    CheckpointPushed,
    CheckpointSave,
    CommandOut,
    CommandPreview,
    JobCreate,
    JobStatus,
    Metrics,
    TrainingConfig,
    TrainJob,
)

router = APIRouter(prefix="/training", tags=["training"])


@router.get("/config", response_model=TrainingConfig)
def get_config():
    return service.get_config()


@router.get("/jobs", response_model=list[TrainJob])
def list_jobs(status: JobStatus | None = None):
    return service.list_jobs(status)


@router.post("/jobs", response_model=TrainJob, status_code=202)
def create_job(body: JobCreate):
    return service.create_job(body)


@router.post("/command-preview", response_model=CommandPreview)
def command_preview(body: JobCreate):
    return service.preview(body)


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


@router.get("/jobs/{job_id}/command", response_model=CommandOut)
def job_command(job_id: str):
    return CommandOut(command=service.job_command(job_id))


@router.get("/jobs/{job_id}/checkpoints/{step}/download")
def download_checkpoint(job_id: str, step: int):
    service.get_checkpoint(job_id, step)
    raise ApiError(501, "Checkpoint download is not implemented yet")


@router.post(
    "/jobs/{job_id}/checkpoints/{step}/push", response_model=CheckpointPushed, status_code=202
)
def push_checkpoint(job_id: str, step: int, body: CheckpointPush | None = None):
    return CheckpointPushed(repo=service.push_checkpoint(job_id, step, body.repo if body else None))


@router.post("/jobs/{job_id}/checkpoints/{step}/save", response_model=Model, status_code=201)
def save_checkpoint(job_id: str, step: int, body: CheckpointSave):
    return service.save_checkpoint(job_id, step, body.name)

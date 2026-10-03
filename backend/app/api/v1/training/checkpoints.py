"""Checkpoints of a training job: download, push to the Hub, save as a model."""

from fastapi import APIRouter

from app.models.models import Model
from app.schemas.training import CheckpointPush, CheckpointPushed, CheckpointSave
from app.services import training as service

router = APIRouter()


@router.get("/jobs/{job_id}/checkpoints/{step}/download")
def download_checkpoint(job_id: str, step: int):
    return service.download_checkpoint(job_id, step)


@router.post(
    "/jobs/{job_id}/checkpoints/{step}/push", response_model=CheckpointPushed, status_code=202
)
def push_checkpoint(job_id: str, step: int, body: CheckpointPush | None = None):
    return service.push_checkpoint(job_id, step, body)


@router.post("/jobs/{job_id}/checkpoints/{step}/save", response_model=Model, status_code=201)
def save_checkpoint(job_id: str, step: int, body: CheckpointSave):
    return service.save_checkpoint(job_id, step, body)

"""Training defaults and the command preview for a draft job."""

from fastapi import APIRouter

from app.schemas.training import CommandPreview, JobCreate, TrainingConfig
from app.services import training as service

router = APIRouter()


@router.get("/config", response_model=TrainingConfig)
def get_config():
    return service.get_config()


@router.post("/command-preview", response_model=CommandPreview)
def command_preview(body: JobCreate):
    return service.preview(body)

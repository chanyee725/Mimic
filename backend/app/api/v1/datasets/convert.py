"""Conversion of a task's recordings into a LeRobot dataset."""

from fastapi import APIRouter, Query

from app.models.datasets import Dataset
from app.schemas.datasets import ConvertBody, ConvertPreview
from app.services import datasets as service

router = APIRouter()


@router.get("/convert/preview", response_model=ConvertPreview)
def convert_preview(task_id: str = Query(alias="taskId"), exclude: str | None = None):
    return service.preview(task_id, exclude)


@router.post("/convert", status_code=202, response_model=Dataset)
async def convert(body: ConvertBody):
    return service.convert(body.task_id, body.repo_id, body.exclude)

"""Merging ready LeRobot datasets into a new one (registered before /datasets/{repo_id:path})."""

from fastapi import APIRouter

from app.models.datasets import Dataset
from app.schemas.datasets import MergeBody, MergePreview
from app.services import datasets as service

router = APIRouter()


@router.get("/datasets/merge/preview", response_model=MergePreview)
def merge_preview(sources: str | None = None):
    return service.merge_preview(sources)


@router.post("/datasets/merge", status_code=202, response_model=Dataset)
def merge(body: MergeBody):
    return service.merge(body.sources, body.repo_id)

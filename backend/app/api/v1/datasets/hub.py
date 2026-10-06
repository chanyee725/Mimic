"""Pulling a LeRobot dataset from the Hugging Face Hub (registered before /datasets/{repo_id:path})."""

from fastapi import APIRouter

from app.models.datasets import Dataset
from app.schemas.datasets import PullBody
from app.services import datasets as service

router = APIRouter()


@router.post("/datasets/pull", status_code=202, response_model=Dataset)
def pull(body: PullBody):
    return service.pull(body.repo_id)

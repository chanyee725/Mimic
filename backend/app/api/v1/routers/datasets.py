"""Datasets endpoints — see docs/api/datasets.md.

repoId contains a slash, so routes use the path converter; the suffixed routes come first.
"""

from fastapi import APIRouter, Query, Response

from app.models.datasets import Dataset, DatasetEpisode, DatasetKind
from app.schemas.common import Page
from app.schemas.datasets import ConvertBody, ConvertPreview, PushBody
from app.services import datasets as service

router = APIRouter(prefix="", tags=["datasets"])


@router.get("/convert/preview", response_model=ConvertPreview)
def convert_preview(task_id: str = Query(alias="taskId"), exclude: str | None = None):
    return service.preview(task_id, exclude)


@router.post("/convert", status_code=202, response_model=Dataset)
async def convert(body: ConvertBody):
    return service.convert(body.task_id, body.repo_id, body.exclude)


@router.get("/datasets", response_model=list[Dataset])
def list_datasets(kind: DatasetKind | None = None, q: str | None = None):
    return service.search(kind, q)


@router.get("/datasets/{repo_id:path}/episodes", response_model=Page[DatasetEpisode])
def list_episodes(repo_id: str, limit: int = Query(50, ge=1, le=500), cursor: str | None = None):
    return service.page_episodes(repo_id, limit, cursor)


@router.get("/datasets/{repo_id:path}/thumbnail")
def thumbnail(repo_id: str):
    return service.thumbnail(repo_id)


@router.post("/datasets/{repo_id:path}/push", status_code=202, response_model=Dataset)
def push(repo_id: str, body: PushBody):
    return service.push(repo_id, body.private)


@router.get("/datasets/{repo_id:path}", response_model=Dataset)
def get_dataset(repo_id: str):
    return service.require(repo_id)


@router.delete("/datasets/{repo_id:path}", status_code=204)
def delete_dataset(repo_id: str):
    service.delete(repo_id)
    return Response(status_code=204)

"""Datasets endpoints — see docs/api/datasets.md.

repoId contains a slash, so routes use the path converter; the suffixed routes come first.
"""

from fastapi import APIRouter, Query, Response

from app.core.errors import ApiError
from app.core.schemas import Page
from app.datasets import service
from app.datasets.schemas import (
    ConvertBody,
    ConvertPreview,
    Dataset,
    DatasetEpisode,
    DatasetKind,
    PushBody,
)

router = APIRouter(prefix="", tags=["datasets"])


def _ids(csv: str | None) -> list[str]:
    return [s.strip() for s in (csv or "").split(",") if s.strip()]


@router.get("/convert/preview", response_model=ConvertPreview)
def convert_preview(task_id: str = Query(alias="taskId"), exclude: str | None = None):
    return service.preview(task_id, _ids(exclude))


@router.post("/convert", status_code=202, response_model=Dataset)
async def convert(body: ConvertBody):
    ds = service.start_conversion(body.task_id, body.repo_id, body.exclude)
    service.schedule(ds.repo_id)
    return ds


@router.get("/datasets", response_model=list[Dataset])
def list_datasets(kind: DatasetKind | None = None, q: str | None = None):
    return service.search(kind, q)


@router.get("/datasets/{repo_id:path}/episodes", response_model=Page[DatasetEpisode])
def list_episodes(repo_id: str, limit: int = Query(50, ge=1, le=500), cursor: str | None = None):
    return service.page_episodes(repo_id, limit, cursor)


@router.get("/datasets/{repo_id:path}/thumbnail")
def thumbnail(repo_id: str):
    service.require(repo_id)
    raise ApiError(501, "Thumbnails are not available yet")


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

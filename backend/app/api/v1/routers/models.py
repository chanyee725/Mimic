"""Models endpoints — see docs/api/models.md."""

from typing import Literal

from fastapi import APIRouter, Query, Response

from app.core.errors import ApiError
from app.services import models as service
from app.schemas.models import Model, ModelFile, ModelPatch, ModelPush

router = APIRouter(prefix="/models", tags=["models"])


@router.get("", response_model=list[Model])
def list_models(
    task_id: str | None = Query(None, alias="taskId"),
    location: Literal["local", "hub"] | None = None,
):
    return service.list_models(task_id, location)


@router.get("/{model_id}", response_model=Model)
def get_model(model_id: str):
    return service.require_model(model_id)


@router.patch("/{model_id}", response_model=Model)
def patch_model(model_id: str, body: ModelPatch):
    return service.rename(model_id, body.name.strip())


@router.delete("/{model_id}", status_code=204)
def delete_model(model_id: str):
    service.delete(model_id)
    return Response(status_code=204)


@router.get("/{model_id}/files", response_model=list[ModelFile])
def model_files(model_id: str):
    service.require_model(model_id)
    return service.model_files()


@router.get("/{model_id}/download")
def download_model(model_id: str):
    service.require_model(model_id)
    raise ApiError(501, "Model download is not implemented yet")


@router.post("/{model_id}/push", response_model=Model, status_code=202)
def push_model(model_id: str, body: ModelPush | None = None):
    return service.push(model_id, body.repo if body else None)

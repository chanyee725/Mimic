"""Isaac Sim environments: USD stages scanned from the environments folder, deleted."""

from fastapi import APIRouter, Response
from fastapi.responses import FileResponse

from app.models.simulation import SimEnv
from app.schemas.simulation import RescanResult
from app.services import simulation as service

router = APIRouter()


@router.get("/envs", response_model=list[SimEnv])
def list_envs():
    return service.list_envs()


# Before /envs/{env_id}
@router.post("/envs/rescan", response_model=RescanResult)
def rescan():
    return service.rescan()


@router.get("/envs/{env_id}", response_model=SimEnv)
def get_env(env_id: str):
    return service.get_env(env_id)


@router.get("/envs/{env_id}/thumbnail", response_class=FileResponse)
def env_thumbnail(env_id: str):
    path, media_type = service.thumbnail(env_id)
    return FileResponse(path, media_type=media_type)


@router.delete("/envs/{env_id}", status_code=204)
def delete_env(env_id: str):
    service.delete_env(env_id)
    return Response(status_code=204)

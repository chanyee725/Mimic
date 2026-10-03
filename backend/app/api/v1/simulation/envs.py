"""Registered Isaac Sim environments and model compatibility."""

from fastapi import APIRouter

from app.models.simulation import SimEnv, SimEnvState
from app.schemas.simulation import ModelCompat, RescanResult
from app.services import simulation as service

router = APIRouter()


@router.get("/envs", response_model=list[SimEnv])
def list_envs(state: SimEnvState | None = None):
    return service.list_envs(state)


# Before /envs/{env_id}
@router.post("/envs/rescan", response_model=RescanResult)
def rescan():
    return service.rescan()


@router.get("/envs/{env_id}", response_model=SimEnv)
def get_env(env_id: str):
    return service.get_env(env_id)


@router.get("/envs/{env_id}/compat", response_model=list[ModelCompat])
def env_compat(env_id: str):
    return service.compat(env_id)

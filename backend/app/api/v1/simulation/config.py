"""Simulation settings snapshot."""

from fastapi import APIRouter

from app.models.simulation import SimConfig
from app.services import simulation as service

router = APIRouter()


@router.get("/config", response_model=SimConfig)
def sim_config():
    return service.sim_config()

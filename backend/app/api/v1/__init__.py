"""Version 1 of the REST + WebSocket API: one package per feature, one module per sub-resource."""

from fastapi import APIRouter

from app.api.v1 import (
    capture,
    datasets,
    evaluate,
    health,
    models,
    realtime,
    recordings,
    rigs,
    settings,
    simulation,
    station,
    tasks,
    training,
)

api_router = APIRouter()
for module in (
    health,
    station,
    tasks,
    rigs,
    capture,
    recordings,
    datasets,
    training,
    models,
    evaluate,
    simulation,
    settings,
    realtime,
):
    api_router.include_router(module.router)

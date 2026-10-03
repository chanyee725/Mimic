"""Version 1 of the REST + WebSocket API: one router module per area."""

from fastapi import APIRouter

from app.api.v1.routers import (
    capture,
    datasets,
    evaluate,
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

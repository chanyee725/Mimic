"""FastAPI app: mounts every area router under /api/v1."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.capture.router import router as capture
from app.core import errors
from app.core.config import config
from app.datasets.router import router as datasets
from app.evaluate.router import router as evaluate
from app.models.router import router as models
from app.realtime.router import router as realtime
from app.recordings.router import router as recordings
from app.rigs.router import router as rigs
from app.settings.router import router as settings
from app.simulation.router import router as simulation
from app.station.router import router as station
from app.tasks.router import router as tasks
from app.training.router import router as training

ROUTERS = [
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
]


def create_app() -> FastAPI:
    p = config.api_prefix
    app = FastAPI(
        title="VLA Data Pipeline",
        version="0.1.0",
        openapi_url=f"{p}/openapi.json",
        docs_url=f"{p}/docs",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    errors.install(app)

    @app.get(f"{p}/health", tags=["health"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    for r in ROUTERS:
        app.include_router(r, prefix=p)
    return app


app = create_app()

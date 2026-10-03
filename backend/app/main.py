"""FastAPI app: mounts every area router under /api/v1."""

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import api_router
from app.core import errors
from app.services import capture
from app.configs.config import config


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Background watchers that push events without a request
    tasks = [asyncio.create_task(capture.watch())]
    yield
    for t in tasks:
        t.cancel()


def create_app() -> FastAPI:
    p = config.api_prefix
    app = FastAPI(
        title="VLA Data Pipeline",
        version="0.1.0",
        openapi_url=f"{p}/openapi.json",
        docs_url=f"{p}/docs",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    errors.install(app)
    app.include_router(api_router, prefix=p)
    return app


app = create_app()

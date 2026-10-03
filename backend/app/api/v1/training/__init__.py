"""Training endpoints — see docs/api/training.md."""

from fastapi import APIRouter

from . import config, jobs, checkpoints

PREFIX = "/training"

router = APIRouter(tags=["training"])
router.include_router(config.router, prefix=PREFIX)
router.include_router(jobs.router, prefix=PREFIX)
router.include_router(checkpoints.router, prefix=PREFIX)

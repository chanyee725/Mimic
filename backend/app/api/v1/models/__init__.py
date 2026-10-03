"""Models endpoints — see docs/api/models.md."""

from fastapi import APIRouter

from . import models

PREFIX = "/models"

router = APIRouter(tags=["models"])
router.include_router(models.router, prefix=PREFIX)

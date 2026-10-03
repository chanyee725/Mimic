"""Evaluate endpoints — see docs/api/models.md."""

from fastapi import APIRouter

from . import runs

PREFIX = "/evaluate"

router = APIRouter(tags=["evaluate"])
router.include_router(runs.router, prefix=PREFIX)

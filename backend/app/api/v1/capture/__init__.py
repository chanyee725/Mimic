"""Capture endpoints — see docs/api/capture.md."""

from fastapi import APIRouter

from . import capture

PREFIX = "/capture"

router = APIRouter(tags=["capture"])
router.include_router(capture.router, prefix=PREFIX)

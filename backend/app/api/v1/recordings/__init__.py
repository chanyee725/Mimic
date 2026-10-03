"""Recordings endpoints — see docs/api/recordings.md."""

from fastapi import APIRouter

from . import recordings

PREFIX = "/recordings"

router = APIRouter(tags=["recordings"])
router.include_router(recordings.router, prefix=PREFIX)

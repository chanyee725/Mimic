"""Capture endpoints — see docs/api/capture.md."""

from fastapi import APIRouter

router = APIRouter(prefix="/capture", tags=["capture"])

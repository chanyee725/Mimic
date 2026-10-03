"""Recordings endpoints — see docs/api/recordings.md."""

from fastapi import APIRouter

router = APIRouter(prefix="/recordings", tags=["recordings"])

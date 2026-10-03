"""Settings endpoints — see docs/api/settings.md."""

from fastapi import APIRouter

router = APIRouter(prefix="/settings", tags=["settings"])

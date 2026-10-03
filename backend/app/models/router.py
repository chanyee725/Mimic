"""Models endpoints — see docs/api/models.md."""

from fastapi import APIRouter

router = APIRouter(prefix="/models", tags=["models"])

"""Station endpoints — see docs/api/station.md."""

from fastapi import APIRouter

router = APIRouter(prefix="/station", tags=["station"])

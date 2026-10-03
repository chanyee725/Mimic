"""Station endpoints — see docs/api/station.md."""

from fastapi import APIRouter

from . import station

PREFIX = "/station"

router = APIRouter(tags=["station"])
router.include_router(station.router, prefix=PREFIX)

"""Settings endpoints — see docs/api/settings.md."""

from fastapi import APIRouter

from . import secrets, settings

PREFIX = "/settings"

router = APIRouter(tags=["settings"])
router.include_router(secrets.router, prefix=PREFIX)
router.include_router(settings.router, prefix=PREFIX)

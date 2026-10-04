"""Rigs endpoints — see docs/api/rigs.md."""

from fastapi import APIRouter

from . import rigs, devices

router = APIRouter(tags=["rigs"])
router.include_router(rigs.router)
router.include_router(devices.router)

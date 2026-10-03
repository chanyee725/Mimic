"""Realtime endpoints — see docs/api/realtime.md."""

from fastapi import APIRouter

from . import events, webrtc

router = APIRouter(tags=["realtime"])
router.include_router(events.router)
router.include_router(webrtc.router)

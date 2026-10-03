"""Tasks endpoints — see docs/api/tasks.md."""

from fastapi import APIRouter

from . import tasks, sessions

router = APIRouter(tags=["tasks"])
router.include_router(tasks.router)
router.include_router(sessions.router)

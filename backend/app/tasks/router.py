"""Tasks endpoints — see docs/api/tasks.md."""

from fastapi import APIRouter

router = APIRouter(prefix="", tags=["tasks"])

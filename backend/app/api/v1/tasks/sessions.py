"""Recording sessions, optionally filtered by task."""

from fastapi import APIRouter

from app.api.deps import TaskIdFilter
from app.models.tasks import Session
from app.services import tasks as service

router = APIRouter()


@router.get("/sessions", response_model=list[Session])
def list_sessions(task_id: TaskIdFilter = None):
    return service.list_sessions(task_id)

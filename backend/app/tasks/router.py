"""Tasks endpoints — see docs/api/tasks.md."""

from typing import Annotated

from fastapi import APIRouter, Header, Query, Request, Response

from app.tasks import service
from app.tasks.schemas import (
    OPERATOR_ID,
    Session,
    Task,
    TaskDuplicate,
    TaskInput,
    TaskStatus,
    TaskUpdate,
)

router = APIRouter(prefix="", tags=["tasks"])

# Pseudonymous operator making the change
Operator = Annotated[str, Header(alias="X-Operator", pattern=OPERATOR_ID)]
YAML = "text/yaml"


@router.get("/tasks", response_model=list[Task])
def list_tasks(status: TaskStatus | None = None):
    return service.list_tasks(status)


@router.post("/tasks", response_model=Task, status_code=201)
def create_task(body: TaskInput, x_operator: Operator = "OP-01"):
    return service.create_task(body, x_operator)


@router.post(
    "/tasks/import",
    response_model=Task,
    status_code=201,
    openapi_extra={
        "requestBody": {"required": True, "content": {YAML: {"schema": {"type": "string"}}}}
    },
)
async def import_task(request: Request, x_operator: Operator = "OP-01"):
    text = (await request.body()).decode("utf-8", errors="replace")
    return service.import_task(text, x_operator)


@router.get("/tasks/{task_id}", response_model=Task)
def get_task(task_id: str):
    return service.require_task(task_id)


@router.put("/tasks/{task_id}", response_model=Task)
def update_task(task_id: str, body: TaskUpdate, x_operator: Operator = "OP-01"):
    return service.update_task(task_id, body, x_operator)


@router.post("/tasks/{task_id}/duplicate", response_model=Task, status_code=201)
def duplicate_task(task_id: str, body: TaskDuplicate, x_operator: Operator = "OP-01"):
    return service.duplicate_task(task_id, body, x_operator)


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: str):
    service.delete_task(task_id)
    return Response(status_code=204)


@router.get(
    "/tasks/{task_id}/yaml", response_class=Response, responses={200: {"content": {YAML: {}}}}
)
def task_yaml(task_id: str):
    return Response(service.task_yaml(task_id), media_type=YAML)


@router.get("/sessions", response_model=list[Session])
def list_sessions(task_id: Annotated[str | None, Query(alias="taskId")] = None):
    return service.list_sessions(task_id)

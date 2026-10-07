"""Task definitions: CRUD, YAML import / export, duplicate."""

from fastapi import APIRouter, Request, Response

from app.models.tasks import Task, TaskStatus
from app.schemas.tasks import TaskDuplicate, TaskInput, TaskUpdate
from app.services import tasks as service

router = APIRouter()

YAML = "text/yaml"


@router.get("/tasks", response_model=list[Task])
def list_tasks(status: TaskStatus | None = None):
    return service.list_tasks(status)


@router.post("/tasks", response_model=Task, status_code=201)
def create_task(body: TaskInput):
    return service.create_task(body)


@router.post(
    "/tasks/import",
    response_model=Task,
    status_code=201,
    openapi_extra={
        "requestBody": {"required": True, "content": {YAML: {"schema": {"type": "string"}}}}
    },
)
async def import_task(request: Request):
    text = (await request.body()).decode("utf-8", errors="replace")
    return service.import_task(text)


@router.get("/tasks/{task_id}", response_model=Task)
def get_task(task_id: str):
    return service.require_task(task_id)


@router.put("/tasks/{task_id}", response_model=Task)
def update_task(task_id: str, body: TaskUpdate):
    return service.update_task(task_id, body)


@router.post("/tasks/{task_id}/duplicate", response_model=Task, status_code=201)
def duplicate_task(task_id: str, body: TaskDuplicate):
    return service.duplicate_task(task_id, body)


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: str):
    service.delete_task(task_id)
    return Response(status_code=204)


@router.get(
    "/tasks/{task_id}/yaml", response_class=Response, responses={200: {"content": {YAML: {}}}}
)
def task_yaml(task_id: str):
    return Response(service.task_yaml(task_id), media_type=YAML)

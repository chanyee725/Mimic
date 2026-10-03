"""Task store (in memory, seeded from the web mocks)."""

from app.core.clock import iso
from app.core.seed import load
from app.tasks.schemas import Task

_tasks: dict[str, Task] = {}


def reset() -> None:
    _tasks.clear()
    for t in load("tasks", "TASKS"):
        t["updatedAt"] = iso(t["updatedAt"]) if " " in t["updatedAt"] else t["updatedAt"]
        _tasks[t["id"]] = Task.model_validate(t)


def list_tasks() -> list[Task]:
    return list(_tasks.values())


def get_task(task_id: str) -> Task | None:
    return _tasks.get(task_id)


reset()

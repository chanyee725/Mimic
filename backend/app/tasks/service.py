"""Task and session store (in memory, seeded from the web mocks)."""

from app.core.clock import iso, now_iso
from app.core.errors import ApiError, conflict, not_found
from app.core.events import bus
from app.core.seed import load
from app.rigs.service import get_rig
from app.tasks import yaml_io
from app.tasks.schemas import (
    Session,
    Task,
    TaskDuplicate,
    TaskFields,
    TaskInput,
    TaskStatus,
    TaskUpdate,
)

_tasks: dict[str, Task] = {}
_sessions: dict[str, Session] = {}


def _seed_time(value: str) -> str:
    # Seeds carry "YYYY-MM-DD" or "YYYY-MM-DD HH:MM"
    if "T" in value:
        return value
    return iso(value if " " in value else f"{value} 00:00")


def reset() -> None:
    _tasks.clear()
    for t in load("tasks", "TASKS"):
        t["updatedAt"] = _seed_time(t["updatedAt"])
        _tasks[t["id"]] = Task.model_validate(t)
    _sessions.clear()
    _sessions.update({s["id"]: Session.model_validate(s) for s in load("sessions", "SESSIONS")})


def list_tasks(status: TaskStatus | None = None) -> list[Task]:
    return [t for t in _tasks.values() if status is None or t.status == status]


def get_task(task_id: str) -> Task | None:
    return _tasks.get(task_id)


def require_task(task_id: str) -> Task:
    task = _tasks.get(task_id)
    if task is None:
        raise not_found("Task", task_id)
    return task


# --- validation -------------------------------------------------------------


def problems(fields: TaskFields) -> list[tuple[tuple, str]]:
    """Cross-field rules against the rig; returns (field loc, message) pairs."""
    out: list[tuple[tuple, str]] = []
    rig = get_rig(fields.rig_id)
    if rig is None:
        return [(("rig_id",), f"unknown rig '{fields.rig_id}'")]
    keys = [c.key for c in rig.cameras]
    for i, cam in enumerate(fields.cameras):
        if cam not in keys:
            out.append((("cameras", i), f"'{cam}' is not a camera of rig '{rig.id}' ({keys})"))
    if len(set(fields.cameras)) != len(fields.cameras):
        out.append((("cameras",), "duplicate camera"))
    if fields.action_hz not in rig.action_hz_options:
        out.append((("action_hz",), f"must be one of {rig.action_hz_options}"))
    if fields.video_fps not in rig.video_fps_options:
        out.append((("video_fps",), f"must be one of {rig.video_fps_options}"))
    seen: set[str] = set()
    for i, s in enumerate(fields.subtasks):
        if s.key in seen:
            out.append((("subtasks", i, "key"), f"duplicate subtask key '{s.key}'"))
        seen.add(s.key)
    values = [o.value for o in fields.outcomes]
    if len(set(values)) != len(values):
        out.append((("outcomes",), "duplicate outcome"))
    return out


def _alias(name: str) -> str:
    info = TaskInput.model_fields.get(name)
    return info.alias if info and info.alias else name


def _check(fields: TaskFields) -> None:
    found = problems(fields)
    if found:
        errors = [{"loc": ["body", _alias(loc[0]), *loc[1:]], "msg": msg} for loc, msg in found]
        raise ApiError(422, "Task is invalid", {"errors": errors})


def _ensure_new(task_id: str) -> None:
    if task_id in _tasks:
        raise conflict(f"Task '{task_id}' already exists", id=task_id)


def _store(task: Task, event: str) -> Task:
    _tasks[task.id] = task
    bus.publish(event, task)
    return task


# --- writes -----------------------------------------------------------------


def create_task(body: TaskInput, operator: str) -> Task:
    _check(body)
    _ensure_new(body.id)
    task = Task(**body.model_dump(), version=1, updated_at=now_iso(), updated_by=operator)
    return _store(task, "task.created")


def update_task(task_id: str, body: TaskUpdate, operator: str) -> Task:
    cur = require_task(task_id)
    if body.id is not None and body.id != task_id:
        raise ApiError(422, "Task id is immutable", {"errors": [{"loc": ["body", "id"]}]})
    if body.version != cur.version:
        raise conflict(
            "Task was changed by someone else",
            current=cur.model_dump(by_alias=True, mode="json"),
        )
    _check(body)
    task = Task.model_validate(
        {
            **cur.model_dump(),
            **body.model_dump(exclude={"id", "version"}),
            "version": cur.version + 1,
            "updated_at": now_iso(),
            "updated_by": operator,
        }
    )
    return _store(task, "task.updated")


def duplicate_task(task_id: str, body: TaskDuplicate, operator: str) -> Task:
    src = require_task(task_id)
    _ensure_new(body.id)
    task = src.model_copy(
        update={
            "id": body.id,
            "name": body.name,
            "status": "draft",
            "collected": 0,
            "version": 1,
            "updated_at": now_iso(),
            "updated_by": operator,
        }
    )
    return _store(task, "task.created")


def delete_task(task_id: str) -> None:
    require_task(task_id)
    # Lazy import: recordings may import tasks
    from app.recordings.service import list_recordings

    count = len(list_recordings(task_id))
    if count:
        raise conflict(f"Task '{task_id}' has {count} recordings", recordings=count)
    del _tasks[task_id]
    bus.publish("task.deleted", {"id": task_id})


def task_yaml(task_id: str) -> str:
    return yaml_io.dump(require_task(task_id))


def import_task(text: str, operator: str) -> Task:
    body, lines = yaml_io.parse(text)
    found = problems(body)
    if found:
        raise ApiError(422, "Task YAML is invalid", {"errors": yaml_io.errors_at(lines, found)})
    _ensure_new(body.id)
    task = Task(**body.model_dump(), version=1, updated_at=now_iso(), updated_by=operator)
    return _store(task, "task.created")


# --- sessions ---------------------------------------------------------------


def list_sessions(task_id: str | None = None) -> list[Session]:
    rows = [s for s in _sessions.values() if task_id is None or s.task_id == task_id]
    return sorted(rows, key=lambda s: (s.date, s.id), reverse=True)


reset()

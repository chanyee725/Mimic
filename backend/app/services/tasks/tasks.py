"""Tasks persist as data/tasks/<id>.yaml (store.py); collected and sessions come from recordings.

No seeds: a missing or empty folder means no tasks.
"""

from collections import Counter

from app.core.errors import ApiError, conflict, not_found
from app.core.events import bus
from app.models.tasks import Session, Task, TaskFields, TaskStatus
from app.schemas.tasks import TaskDuplicate, TaskInput, TaskUpdate
from app.services.rigs import get_rig
from app.services.tasks import sessions, store, yaml_io
from app.utils.time import now_iso

# Stored tasks; `collected` is filled in on the way out (_view)
_tasks: dict[str, Task] = {}


def reset() -> None:
    _tasks.clear()
    _tasks.update({t.id: t for t in store.load_all()})


def _recordings(task_id: str | None = None):
    # Lazy import: recordings may import tasks
    from app.services.recordings import list_recordings

    return list_recordings(task_id)


def _collected(recs) -> Counter:
    """Usable episodes per task: accepted + pending (rejected ones do not count)."""
    return Counter(r.task_id for r in recs if r.task_id and r.review != "rejected")


def _view(task: Task, counts: Counter | None = None) -> Task:
    if counts is None:
        counts = _collected(_recordings(task.id))
    return task.model_copy(update={"collected": counts.get(task.id, 0)})


def list_tasks(status: TaskStatus | None = None) -> list[Task]:
    counts = _collected(_recordings())
    return [_view(t, counts) for t in _tasks.values() if status is None or t.status == status]


def get_task(task_id: str) -> Task | None:
    task = _tasks.get(task_id)
    return _view(task) if task else None


def require_task(task_id: str) -> Task:
    task = get_task(task_id)
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
    if fields.env_id:
        out += [(("env_id",), msg) for msg in _env_problems(fields.env_id)]
    seen: set[str] = set()
    for i, s in enumerate(fields.subtasks):
        if s.key in seen:
            out.append((("subtasks", i, "key"), f"duplicate subtask key '{s.key}'"))
        seen.add(s.key)
    values = [o.value for o in fields.outcomes]
    if len(set(values)) != len(values):
        out.append((("outcomes",), "duplicate outcome"))
    return out


def _env_problems(env_id: str) -> list[str]:
    """An Isaac Sim task's environment must be registered."""
    from app.services import simulation  # lazy: simulation reads tasks

    return [] if simulation.find_env(env_id) else [f"unknown environment '{env_id}'"]


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
    task = task.model_copy(update={"collected": 0})  # never stored
    store.save(task)
    _tasks[task.id] = task
    task = _view(task)
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
    count = len(_recordings(task_id))
    if count:
        raise conflict(f"Task '{task_id}' has {count} recordings", recordings=count)
    store.remove(task_id)
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
    """Recordings grouped by task and station day, newest first."""
    return sessions.from_recordings(_recordings(task_id))


reset()

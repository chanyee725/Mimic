"""Task files: data/tasks/<task-id>.yaml (export format + a trailing meta block)."""

import logging
from datetime import date, datetime

import yaml

from app.core import storage
from app.core.errors import ApiError
from app.models.tasks import Task
from app.services.tasks import yaml_io
from app.utils.time import iso, to_iso

log = logging.getLogger(__name__)

FOLDER = "tasks"


def _rel(task_id: str) -> str:
    return f"{FOLDER}/{task_id}.yaml"


def exists() -> bool:
    return storage.path(FOLDER).is_dir()


def dumps(task: Task) -> str:
    meta = {
        "meta": {
            "version": task.version,
            "collected": task.collected,
            "updated_at": task.updated_at,
            "updated_by": task.updated_by,
        }
    }
    return yaml_io.dump(task) + storage.dumps(meta)


def save(task: Task) -> None:
    storage.write_text(_rel(task.id), dumps(task))


def remove(task_id: str) -> None:
    storage.delete(_rel(task_id))


def _when(value: object) -> str:
    # Hand-edited files may drop the quotes; YAML then yields a datetime / date
    if isinstance(value, datetime):
        return to_iso(value)
    if isinstance(value, date):
        return iso(value.isoformat())
    return str(value)


def loads(text: str) -> Task:
    """Parse a task file; raises ApiError / ValueError when it is broken."""
    body, _ = yaml_io.parse(text)
    meta = yaml.safe_load(text).get("meta") or {}
    if not isinstance(meta, dict):
        raise ValueError("meta must be a mapping")
    return Task(
        **body.model_dump(),
        version=meta.get("version", 1),
        collected=meta.get("collected", 0),
        updated_at=_when(meta.get("updated_at", "1970-01-01T00:00:00+00:00")),
        updated_by=meta.get("updated_by", "OP-01"),
    )


def load_all() -> list[Task]:
    """Every readable task file; broken files are logged and skipped."""
    out: dict[str, Task] = {}
    for p in storage.list_yaml(FOLDER):
        try:
            task = loads(p.read_text())
        except (ApiError, ValueError, yaml.YAMLError, OSError) as e:
            detail = e.details if isinstance(e, ApiError) else e
            log.warning("skipping broken task file %s: %s", p, detail)
            continue
        if task.id in out:
            log.warning("skipping %s: task '%s' already loaded", p, task.id)
            continue
        if p.stem != task.id and storage.path(_rel(task.id)).exists():
            log.warning("skipping %s: task '%s' has its own file", p, task.id)
            continue
        if p.stem != task.id:
            # Content wins; move the file so later saves / deletes hit one file
            log.warning("%s holds task '%s'; renaming to %s.yaml", p, task.id, task.id)
            save(task)
            p.unlink(missing_ok=True)
        out[task.id] = task
    return list(out.values())

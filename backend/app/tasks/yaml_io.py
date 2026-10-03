"""Task YAML export / import (format in docs/api/tasks.md)."""

from typing import Any

import yaml
from pydantic import ValidationError

from app.core.errors import ApiError
from app.tasks.schemas import Task, TaskInput

DEFAULT_OUTCOMES = {"success": "→", "fail": "F", "partial": "P"}

# TaskInput field → YAML path
FIELD_PATHS: dict[str, tuple[str, ...]] = {
    "id": ("task_id",),
    "name": ("name",),
    "instruction": ("label",),
    "variants": ("variants",),
    "tags": ("tags",),
    "rig_id": ("rig",),
    "cameras": ("cameras",),
    "action_hz": ("rates", "action_hz"),
    "video_fps": ("rates", "video_fps"),
    "target_episodes": ("episode", "target"),
    "duration_s": ("episode", "duration_s"),
    "reset_s": ("episode", "reset_s"),
    "countdown_s": ("episode", "countdown_s"),
    "outcomes": ("outcomes",),
    "subtasks": ("subtasks",),
    "success_criteria": ("success_criteria",),
    "status": ("status",),
    "repo_id": ("output", "repo_id"),
    "push_to_hub": ("output", "push_to_hub"),
}
_BY_ALIAS = {f.alias: name for name, f in TaskInput.model_fields.items() if f.alias}


def dump(task: Task) -> str:
    doc = {
        "task_id": task.id,
        "name": task.name,
        "label": task.instruction,
        "variants": task.variants,
        "tags": task.tags,
        "rig": task.rig_id,
        "cameras": task.cameras,
        "rates": {"action_hz": task.action_hz, "video_fps": task.video_fps},
        "episode": {
            "target": task.target_episodes,
            "duration_s": task.duration_s,
            "reset_s": task.reset_s,
            "countdown_s": task.countdown_s,
        },
        "outcomes": {o.value: o.key for o in task.outcomes},
        "subtasks": [s.model_dump() for s in task.subtasks],
        "success_criteria": task.success_criteria,
        "status": task.status,
        "output": {
            "repo_id": task.repo_id,
            "format": "lerobot_v3",
            "fps": task.video_fps,
            "push_to_hub": "private" if task.push_to_hub else False,
        },
    }
    return yaml.safe_dump(doc, sort_keys=False, allow_unicode=True, width=1000)


def _lines(node: yaml.Node, path: tuple = ()) -> dict[tuple, int]:
    """YAML path → 1-based line of its key (or item)."""
    out: dict[tuple, int] = {path: node.start_mark.line + 1}
    if isinstance(node, yaml.MappingNode):
        for k, v in node.value:
            sub = path + (k.value,)
            out.update(_lines(v, sub))
            out[sub] = k.start_mark.line + 1
    elif isinstance(node, yaml.SequenceNode):
        for i, v in enumerate(node.value):
            out.update(_lines(v, path + (i,)))
    return out


def _error(lines: dict[tuple, int], path: tuple, msg: str) -> dict[str, Any]:
    for n in range(len(path), -1, -1):
        if path[:n] in lines:
            return {"line": lines[path[:n]], "loc": list(path), "msg": msg}
    return {"line": 1, "loc": list(path), "msg": msg}


def yaml_path(loc: tuple) -> tuple:
    """Map a TaskInput error loc (field, index, sub) to its YAML path."""
    if loc and loc[0] in _BY_ALIAS:
        loc = (_BY_ALIAS[loc[0]], *loc[1:])
    if not loc or loc[0] not in FIELD_PATHS:
        return tuple(loc)
    head = FIELD_PATHS[loc[0]]
    # outcomes are a mapping in YAML; point at the block
    return head if loc[0] == "outcomes" else head + tuple(loc[1:])


def _invalid(errors: list[dict[str, Any]]) -> ApiError:
    return ApiError(422, "Task YAML is invalid", {"errors": errors})


def _push(value: Any) -> Any:
    if value in ("private", "public", True):
        return True
    if value in (False, None, "false", "no"):
        return False
    return value  # let validation reject it


def parse(text: str) -> tuple[TaskInput, dict[tuple, int]]:
    """Parse YAML into a TaskInput; raises 422 with line numbers on errors."""
    try:
        root = yaml.compose(text)
        doc = yaml.safe_load(text)
    except yaml.YAMLError as e:
        mark = getattr(e, "problem_mark", None)
        line = mark.line + 1 if mark else 1
        raise _invalid([{"line": line, "loc": [], "msg": str(getattr(e, "problem", e))}])
    if not isinstance(doc, dict) or root is None:
        raise _invalid([{"line": 1, "loc": [], "msg": "expected a mapping"}])
    lines = _lines(root)

    errors: list[dict[str, Any]] = []
    out: dict[str, Any] = {}
    for field, path in FIELD_PATHS.items():
        cur: Any = doc
        for part in path:
            if not isinstance(cur, dict) or part not in cur:
                cur = ...
                break
            cur = cur[part]
        if cur is not ...:
            out[field] = cur

    if isinstance(out.get("outcomes"), dict):
        out["outcomes"] = [{"value": k, "key": str(v)} for k, v in out["outcomes"].items()]
    elif "outcomes" not in out:
        out["outcomes"] = [{"value": k, "key": v} for k, v in DEFAULT_OUTCOMES.items()]
    if "push_to_hub" in out:
        out["push_to_hub"] = _push(out["push_to_hub"])
    out.setdefault("status", "draft")

    output = doc.get("output") if isinstance(doc.get("output"), dict) else {}
    if output.get("format", "lerobot_v3") != "lerobot_v3":
        errors.append(_error(lines, ("output", "format"), "only lerobot_v3 is supported"))
    if "fps" in output and output["fps"] != out.get("video_fps"):
        errors.append(_error(lines, ("output", "fps"), "must equal rates.video_fps"))

    try:
        task = TaskInput.model_validate(out)
    except ValidationError as e:
        for err in e.errors():
            errors.append(_error(lines, yaml_path(err["loc"]), err["msg"]))
        raise _invalid(errors)
    if errors:
        raise _invalid(errors)
    return task, lines


def errors_at(lines: dict[tuple, int], problems: list[tuple[tuple, str]]) -> list[dict[str, Any]]:
    return [_error(lines, yaml_path(loc), msg) for loc, msg in problems]

"""Environment folder scanner — rules in docs/api/simulation.md."""

import math
from collections.abc import Mapping
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import yaml

from app.core.clock import now_iso
from app.configs.config import config
from app.schemas.simulation import SimEnv, SimEnvFile

MANIFEST = "env.yaml"
REQUIRED = ("name", "scene", "cameras", "action_dim", "episode.success")
DEFAULT_MAX_SECONDS = 40


class ManifestError(Exception):
    pass


def scan_envs(root: Path, first_seen: Mapping[str, str] | None = None) -> list[SimEnv]:
    """One SimEnv per direct sub-folder of root, sorted by id. first_seen maps id → registeredAt."""
    if not root.is_dir():
        return []
    first_seen = first_seen or {}
    folders = [p for p in root.iterdir() if p.is_dir() and not p.name.startswith(("_", "."))]
    return [_load(p, first_seen.get(p.name)) for p in sorted(folders, key=lambda p: p.name)]


def _load(folder: Path, registered_at: str | None) -> SimEnv:
    files = _files(folder)
    updated = _iso(
        max([folder.stat().st_mtime] + [(folder / f.path).stat().st_mtime for f in files])
    )
    base = dict(
        id=folder.name,
        name=folder.name,
        path=str(folder.resolve()),
        files=files,
        registered_at=registered_at or now_iso(),
        updated_at=updated,
    )
    manifest_path = folder / MANIFEST
    if not manifest_path.is_file():
        return SimEnv(**base, state="invalid", error=f"{MANIFEST} not found")
    text = manifest_path.read_text(errors="replace")
    base["manifest"] = text
    try:
        data = _parse(text)
        fields = _fields(data)
    except ManifestError as e:
        return SimEnv(**base, state="invalid", error=f"{MANIFEST}: {e}")
    base.update(fields)
    error = _missing_files(folder, data)
    return SimEnv(**base, state="invalid" if error else "ready", error=error)


def _parse(text: str) -> dict[str, Any]:
    try:
        data = yaml.safe_load(text)
    except yaml.YAMLError as e:
        mark = getattr(e, "problem_mark", None)
        raise ManifestError(f"invalid YAML (line {mark.line + 1})" if mark else "invalid YAML")
    if not isinstance(data, dict):
        raise ManifestError("expected a mapping at the top level")
    for key in REQUIRED:
        if _get(data, key) in (None, ""):
            raise ManifestError(f"missing key '{key}'")
    return data


def _fields(data: dict[str, Any]) -> dict[str, Any]:
    cameras = data["cameras"]
    if isinstance(cameras, dict):
        cameras = list(cameras)
    if not isinstance(cameras, list) or not cameras or not all(isinstance(c, str) for c in cameras):
        raise ManifestError("'cameras' must be a mapping of camera keys")
    action_dim = data["action_dim"]
    if not isinstance(action_dim, int) or isinstance(action_dim, bool) or action_dim <= 0:
        raise ManifestError("'action_dim' must be a positive integer")
    max_seconds = _get(data, "episode.max_seconds")
    if max_seconds is None:
        max_seconds = DEFAULT_MAX_SECONDS
    if not isinstance(max_seconds, (int, float)) or isinstance(max_seconds, bool):
        raise ManifestError("'episode.max_seconds' must be a number")
    task = data.get("task")
    description = data.get("description")
    return dict(
        name=str(data["name"]),
        task_id=str(task) if task else None,
        description=str(description) if description else None,
        cameras=cameras,
        action_dim=action_dim,
        max_seconds=max_seconds,
        calibrated=data.get("calibrated") is True,
    )


def _missing_files(folder: Path, data: dict[str, Any]) -> str | None:
    scene = str(data["scene"])
    if not (folder / scene).is_file():
        return f"{MANIFEST}: {scene} not found"
    success = str(_get(data, "episode.success"))
    module = success.split(":", 1)[0]
    if not (folder / module).is_file():
        return f"{MANIFEST}: {module} not found (expected {success})"
    return None


def _get(data: dict[str, Any], dotted: str) -> Any:
    cur: Any = data
    for part in dotted.split("."):
        if not isinstance(cur, dict):
            return None
        cur = cur.get(part)
    return cur


def _files(folder: Path) -> list[SimEnvFile]:
    out = []
    for p in sorted(folder.rglob("*")):
        rel = p.relative_to(folder)
        if not p.is_file() or any(s.startswith(".") or s == "__pycache__" for s in rel.parts):
            continue
        out.append(SimEnvFile(path=rel.as_posix(), size_kb=math.ceil(p.stat().st_size / 1024)))
    return out


def _iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, ZoneInfo(config.timezone)).isoformat(timespec="seconds")

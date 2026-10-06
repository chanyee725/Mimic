"""Environment scanner — rules in docs/api/simulation.md.

An environment is a USD stage: a top-level `<id>.usd|.usda|.usdc|.usdz` file, or a folder `<id>/`
holding one (`scene.<ext>` first, else its only top-level stage file) with its sub-assets.
"""

import math
from collections.abc import Mapping
from pathlib import Path

from app.models.simulation import SimEnv, SimEnvFile
from app.utils.paths import latest_mtime, size_kb, walk_files
from app.utils.time import from_timestamp, now_iso

USD_EXTS = (".usd", ".usda", ".usdc", ".usdz")


def is_usd(path: Path) -> bool:
    return path.suffix.lower() in USD_EXTS


def scan_envs(root: Path, first_seen: Mapping[str, str] | None = None) -> list[SimEnv]:
    """One SimEnv per stage file or folder with a stage, sorted by id (a folder wins over a file
    with the same id). first_seen maps id → registeredAt."""
    first_seen = first_seen or {}
    if not root.is_dir():
        return []
    found: dict[str, SimEnv] = {}
    for p in sorted(root.iterdir(), key=lambda p: (p.is_file(), p.name)):
        if p.name.startswith(("_", ".")):
            continue
        env_id = p.name if p.is_dir() else p.stem
        if env_id in found:
            continue
        env = _load(p, first_seen.get(env_id))
        if env is not None:
            found[env_id] = env
    return sorted(found.values(), key=lambda e: e.id)


def stage_file(folder: Path) -> Path | None:
    """`scene.<ext>` first, else the only top-level stage file; None for none or several."""
    stages = sorted(p for p in folder.iterdir() if p.is_file() and is_usd(p))
    for p in stages:
        if p.stem == "scene":
            return p
    return stages[0] if len(stages) == 1 else None


def _load(path: Path, registered_at: str | None) -> SimEnv | None:
    if path.is_dir():
        scene = stage_file(path)
        if scene is None:
            return None
        files = [
            SimEnvFile(path=p.relative_to(path).as_posix(), size_kb=size_kb(p))
            for p in walk_files(path)
        ]
        total = sum(p.stat().st_size for p in walk_files(path))
        env_id, updated = path.name, latest_mtime(path)
    elif path.is_file() and is_usd(path):
        scene = path
        files = [SimEnvFile(path=path.name, size_kb=size_kb(path))]
        total = path.stat().st_size
        env_id, updated = path.stem, path.stat().st_mtime
    else:
        return None
    return SimEnv(
        id=env_id,
        name=env_id,
        path=str(path.resolve()),
        scene=scene.name,
        size_kb=math.ceil(total / 1024),
        files=files,
        registered_at=registered_at or now_iso(),
        updated_at=from_timestamp(updated),
    )

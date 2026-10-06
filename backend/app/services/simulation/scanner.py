"""Environment scanner — rules in docs/api/simulation.md.

An environment is a USD stage: a top-level `<id>.usd|.usda|.usdc|.usdz` file, or a folder `<id>/`
holding one (`scene.<ext>` first, else its only top-level stage file) with its sub-assets. A
top-level folder named after a rig groups that rig's environments (same rules inside it). A
thumbnail is `<stem>.<image>` beside a stage file, or `thumbnail.<image>` in an env folder.
"""

import logging
import math
from collections.abc import Collection, Mapping
from pathlib import Path

from app.models.simulation import SimEnv, SimEnvFile
from app.utils.paths import latest_mtime, size_kb, walk_files
from app.utils.time import from_timestamp, now_iso

log = logging.getLogger(__name__)

USD_EXTS = (".usd", ".usda", ".usdc", ".usdz")
IMAGE_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
}


def is_usd(path: Path) -> bool:
    return path.suffix.lower() in USD_EXTS


def _entries(folder: Path) -> list[Path]:
    """Folders before files, by name; hidden and `_` entries skipped."""
    items = [p for p in folder.iterdir() if not p.name.startswith(("_", "."))]
    return sorted(items, key=lambda p: (p.is_file(), p.name))


def scan_envs(
    root: Path, first_seen: Mapping[str, str] | None = None, rig_ids: Collection[str] = ()
) -> list[SimEnv]:
    """One SimEnv per stage file or folder with a stage, sorted by id. On a duplicate id the
    first one found wins (folders before files, top level in name order). first_seen maps
    id → registeredAt."""
    first_seen = first_seen or {}
    if not root.is_dir():
        return []
    found: dict[str, SimEnv] = {}

    def add(path: Path, rig_id: str | None) -> None:
        env_id = path.name if path.is_dir() else path.stem
        env = _load(path, first_seen.get(env_id), rig_id)
        if env is None:
            return
        if env_id in found:
            log.warning("Skipping environment %s: id '%s' is already used", path, env_id)
            return
        found[env_id] = env

    for p in _entries(root):
        if p.is_dir() and p.name in rig_ids:
            for q in _entries(p):
                add(q, p.name)
        else:
            add(p, None)
    return sorted(found.values(), key=lambda e: e.id)


def stage_file(folder: Path) -> Path | None:
    """`scene.<ext>` first, else the only top-level stage file; None for none or several."""
    stages = sorted(p for p in folder.iterdir() if p.is_file() and is_usd(p))
    for p in stages:
        if p.stem == "scene":
            return p
    return stages[0] if len(stages) == 1 else None


def thumbnail_file(path: Path) -> Path | None:
    """The env's image: `thumbnail.<ext>` in a folder, `<stem>.<ext>` beside a stage file."""
    for ext in IMAGE_TYPES:
        p = path / f"thumbnail{ext}" if path.is_dir() else path.with_suffix(ext)
        if p.is_file():
            return p
    return None


def _load(path: Path, registered_at: str | None, rig_id: str | None) -> SimEnv | None:
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
        rig_id=rig_id,
        thumbnail=thumbnail_file(path) is not None,
    )

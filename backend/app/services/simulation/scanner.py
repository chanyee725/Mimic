"""Environment scanner — rules in docs/api/simulation.md.

An environment is a Python script whose build(scene) lays out the stage (sim/runner/scene.py): a
top-level `<id>.py` file, or a folder `<id>/` holding `env.py` with its own files. A thumbnail is
`<stem>.<image>` beside a script, or `thumbnail.<image>` in an env folder. Robots and tools are
also found here: robots/<id>.usd[a|c] or robots/<id>/<id>.usd[a|c] (tools/ alike).
"""

import logging
import math
from collections.abc import Mapping
from pathlib import Path

from app.models.simulation import SimAsset, SimEnv, SimEnvFile
from app.utils.paths import latest_mtime, size_kb, walk_files
from app.utils.time import from_timestamp, now_iso

log = logging.getLogger(__name__)

SCRIPT_EXT = ".py"
ROBOT_EXTS = (".usd", ".usda", ".usdc")
FOLDER_SCRIPT = "env.py"
IMAGE_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
}


def _entries(folder: Path) -> list[Path]:
    """Folders before files, by name; hidden and `_` entries skipped."""
    items = [p for p in folder.iterdir() if not p.name.startswith(("_", "."))]
    return sorted(items, key=lambda p: (p.is_file(), p.name))


def scan_envs(root: Path, first_seen: Mapping[str, str] | None = None) -> list[SimEnv]:
    """One SimEnv per script or folder with an env.py, sorted by id. On a duplicate id the
    folder wins. first_seen maps id → registeredAt."""
    first_seen = first_seen or {}
    if not root.is_dir():
        return []
    found: dict[str, SimEnv] = {}

    for path in _entries(root):
        env_id = path.name if path.is_dir() else path.stem
        env = _load(path, first_seen.get(env_id))
        if env is None:
            continue
        if env_id in found:
            log.warning("Skipping environment %s: id '%s' is already used", path, env_id)
            continue
        found[env_id] = env
    return sorted(found.values(), key=lambda e: e.id)


def robot_file(root: Path, robot_id: str) -> Path | None:
    """Root USD of a robot or tool: <id>.usd… or <id>/<id>.usd…"""
    for ext in ROBOT_EXTS:
        for p in (root / f"{robot_id}{ext}", root / robot_id / f"{robot_id}{ext}"):
            if p.is_file():
                return p
    return None


def _asset(asset_id: str, usd: Path) -> SimAsset:
    folder = usd.parent if usd.parent.name == asset_id else None
    paths = list(walk_files(folder)) if folder else [usd]
    base = folder or usd.parent
    return SimAsset(
        id=asset_id,
        path=str(usd.resolve()),
        size_kb=math.ceil(sum(p.stat().st_size for p in paths) / 1024),
        files=[SimEnvFile(path=p.relative_to(base).as_posix(), size_kb=size_kb(p)) for p in paths],
        updated_at=from_timestamp(latest_mtime(folder) if folder else usd.stat().st_mtime),
    )


def scan_robots(root: Path) -> list[SimAsset]:
    """Robot (or tool) USDs under root, by id."""
    if not root.is_dir():
        return []
    ids = {p.stem if p.is_file() else p.name for p in _entries(root)}
    found = [(i, robot_file(root, i)) for i in sorted(ids)]
    return [_asset(i, f) for i, f in found if f is not None]


def thumbnail_file(path: Path) -> Path | None:
    """The env's image: `thumbnail.<ext>` in a folder, `<stem>.<ext>` beside a script."""
    for ext in IMAGE_TYPES:
        p = path / f"thumbnail{ext}" if path.is_dir() else path.with_suffix(ext)
        if p.is_file():
            return p
    return None


def _load(path: Path, registered_at: str | None) -> SimEnv | None:
    if path.is_dir():
        script = path / FOLDER_SCRIPT
        if not script.is_file():
            return None
        files = [
            SimEnvFile(path=p.relative_to(path).as_posix(), size_kb=size_kb(p))
            for p in walk_files(path)
        ]
        total = sum(p.stat().st_size for p in walk_files(path))
        env_id, updated = path.name, latest_mtime(path)
    elif path.is_file() and path.suffix == SCRIPT_EXT:
        script = path
        files = [SimEnvFile(path=path.name, size_kb=size_kb(path))]
        total = path.stat().st_size
        env_id, updated = path.stem, path.stat().st_mtime
    else:
        return None
    return SimEnv(
        id=env_id,
        name=env_id,
        path=str(path.resolve()),
        script=script.name,
        size_kb=math.ceil(total / 1024),
        files=files,
        registered_at=registered_at or now_iso(),
        updated_at=from_timestamp(updated),
        thumbnail=thumbnail_file(path) is not None,
    )

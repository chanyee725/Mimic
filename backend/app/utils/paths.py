"""Filesystem helpers: user paths, repo-relative display, folder listings."""

import math
from collections.abc import Iterator
from pathlib import Path

from app.configs.config import REPO_ROOT


def resolve_user_path(value: str | Path) -> Path:
    """Expands ~; relative paths are taken from the repo root."""
    path = Path(value).expanduser()
    return path if path.is_absolute() else REPO_ROOT / path


def display_path(path: Path) -> str:
    """Repo-relative when inside the repo (e.g. "sim/envs"), else absolute."""
    try:
        return str(path.resolve().relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def _hidden(name: str) -> bool:
    return name.startswith(".") or name == "__pycache__"


def visible_dirs(root: Path) -> list[Path]:
    """Direct sub-folders sorted by name, skipping "_" / "." folders. Missing root → []."""
    if not root.is_dir():
        return []
    dirs = [p for p in root.iterdir() if p.is_dir() and not p.name.startswith(("_", "."))]
    return sorted(dirs, key=lambda p: p.name)


def walk_files(folder: Path) -> Iterator[Path]:
    """Files under folder (sorted, recursive), skipping dot entries and __pycache__."""
    for p in sorted(folder.rglob("*")):
        if p.is_file() and not any(_hidden(s) for s in p.relative_to(folder).parts):
            yield p


def size_kb(path: Path) -> int:
    return math.ceil(path.stat().st_size / 1024)


def latest_mtime(folder: Path) -> float:
    """Newest mtime of the folder itself and every file under it."""
    return max([folder.stat().st_mtime] + [p.stat().st_mtime for p in walk_files(folder)])

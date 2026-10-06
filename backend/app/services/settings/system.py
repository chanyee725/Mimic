"""Real disk usage of the data folder, package versions and a TCP reachability check."""

import os
import platform
import shutil
from importlib import metadata
from pathlib import Path

from app.configs.config import config
from app.schemas.settings import Disk, DiskPart, VersionRow

MB = 1024**2
GB = 1024**3
NOT_INSTALLED = "not installed"

# Python distribution names shown on the Settings page
PACKAGES = (("FastAPI", "fastapi"), ("Pydantic", "pydantic"), ("mcap", "mcap"))


def dir_size(path: Path) -> int:
    """Total bytes of the regular files under path (symlinks not followed); 0 when missing."""
    total = 0
    stack = [path]
    while stack:
        try:
            entries = list(os.scandir(stack.pop()))
        except OSError:
            continue
        for e in entries:
            try:
                if e.is_dir(follow_symlinks=False):
                    stack.append(Path(e.path))
                elif e.is_file(follow_symlinks=False):
                    total += e.stat(follow_symlinks=False).st_size
            except OSError:
                continue
    return total


def _existing(path: Path) -> Path:
    # disk_usage needs an existing path; a missing data folder reports its parent's disk
    while not path.exists() and path != path.parent:
        path = path.parent
    return path


def disk_used_pct() -> float:
    usage = shutil.disk_usage(_existing(config.data_dir))
    return 100 * usage.used / usage.total if usage.total else 0.0


def disk() -> Disk:
    """Disk holding the data folder: recordings / datasets / models sizes, other = rest of used."""
    usage = shutil.disk_usage(_existing(config.data_dir))
    sizes = [
        ("raw", "Recordings", dir_size(config.recordings_dir)),
        ("datasets", "Datasets", dir_size(config.datasets_dir)),
        ("models", "Models", dir_size(config.models_dir)),
    ]
    other = max(0, usage.used - sum(b for _, _, b in sizes))
    parts = [DiskPart(key=k, label=label, gb=_gb(b)) for k, label, b in sizes]
    parts.append(DiskPart(key="other", label="Other", gb=_gb(other)))
    return Disk(total_gb=_gb(usage.total), parts=parts)


def _gb(n: int) -> float:
    return round(n / GB, 3)


def _version(dist: str) -> str:
    try:
        return metadata.version(dist)
    except metadata.PackageNotFoundError:
        return NOT_INSTALLED


def versions() -> list[VersionRow]:
    rows = [VersionRow(k="Python", v=platform.python_version())]
    rows += [VersionRow(k=label, v=_version(dist)) for label, dist in PACKAGES]
    rows.append(VersionRow(k="lerobot", v=_version("lerobot")))
    return rows

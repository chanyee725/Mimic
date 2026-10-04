"""YAML files of the station; atomic writes to any path.

Relative paths starting with a config area (rigs/, settings/, calibration/) live in the config
folder (config.config_dir: hand-set station setup, committed); everything else in the data folder
(config.data_dir: what the web produces — tasks, recordings, datasets, models).
"""

import logging
import os
import shutil
import tempfile
from pathlib import Path
from typing import Any

import yaml

from app.configs.config import config


class StorageError(Exception):
    """A file exists but is not valid YAML."""


log = logging.getLogger(__name__)

CONFIG_AREAS = ("rigs", "settings", "calibration")


def path(*parts: str) -> Path:
    first = Path(*parts).parts[0] if parts else ""
    root = config.config_dir if first in CONFIG_AREAS else config.data_dir
    return root.joinpath(*parts)


def adopt_legacy(area: str) -> None:
    """Move <data>/<area> (where config areas used to live) into the config folder once."""
    old, new = config.data_dir / area, config.config_dir / area
    if old.is_dir() and not new.exists():
        new.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(old, new)
        log.info("Moved %s to %s", old, new)


def dumps(data: Any) -> str:
    return yaml.safe_dump(data, sort_keys=False, allow_unicode=True, width=1000)


def read_file(p: Path) -> Any | None:
    """Parsed YAML at any path, or None when the file does not exist."""
    if not p.is_file():
        return None
    try:
        return yaml.safe_load(p.read_text())
    except yaml.YAMLError as e:
        raise StorageError(f"{p}: {e}") from e


def read(rel: str) -> Any | None:
    """Parsed YAML under data_dir, or None when the file does not exist."""
    return read_file(path(rel))


def read_text(rel: str) -> str | None:
    p = path(rel)
    return p.read_text() if p.is_file() else None


def write_file(p: Path, data: str | bytes, private: bool = False) -> None:
    """Atomic write to any path (temp file + rename); private files are chmod 600."""
    p.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=p.parent, prefix=f".{p.name}.")
    try:
        with os.fdopen(fd, "wb" if isinstance(data, bytes) else "w") as f:
            f.write(data)
        os.chmod(tmp, 0o600 if private else 0o644)
        os.replace(tmp, p)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise


def write_text(rel: str, text: str, private: bool = False) -> None:
    write_file(path(rel), text, private)


def write(rel: str, data: Any, private: bool = False) -> None:
    write_text(rel, dumps(data), private)


def delete(rel: str) -> None:
    path(rel).unlink(missing_ok=True)


def exists(rel: str) -> bool:
    return path(rel).exists()


def list_yaml(folder: str) -> list[Path]:
    """*.yaml files directly in folder, sorted by name; [] when missing."""
    d = path(folder)
    return sorted(d.glob("*.yaml")) if d.is_dir() else []

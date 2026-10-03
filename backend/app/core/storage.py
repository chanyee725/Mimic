"""YAML files under config.data_dir (rigs/, settings/, …)."""

import os
import tempfile
from pathlib import Path
from typing import Any

import yaml

from app.configs.config import config


class StorageError(Exception):
    """A file exists but is not valid YAML."""


def path(*parts: str) -> Path:
    return config.data_dir.joinpath(*parts)


def dumps(data: Any) -> str:
    return yaml.safe_dump(data, sort_keys=False, allow_unicode=True, width=1000)


def read(rel: str) -> Any | None:
    """Parsed YAML, or None when the file does not exist."""
    p = path(rel)
    if not p.is_file():
        return None
    try:
        return yaml.safe_load(p.read_text())
    except yaml.YAMLError as e:
        raise StorageError(f"{p}: {e}") from e


def read_text(rel: str) -> str | None:
    p = path(rel)
    return p.read_text() if p.is_file() else None


def write_text(rel: str, text: str, private: bool = False) -> None:
    """Atomic write (temp file + rename); private files are chmod 600."""
    p = path(rel)
    p.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=p.parent, prefix=f".{p.name}.")
    try:
        with os.fdopen(fd, "w") as f:
            f.write(text)
        os.chmod(tmp, 0o600 if private else 0o644)
        os.replace(tmp, p)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise


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

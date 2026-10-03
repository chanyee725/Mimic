"""Recordings on disk: <raw>/<folder>/<name>.mcap plus a <name>.yaml sidecar (the index).

The raw folder is Settings storage.raw_path (relative paths start at the repo root).
Sidecars hold the Recording fields in snake_case; `file` always follows the sidecar location.
"""

import logging
from pathlib import Path

from pydantic import ValidationError

from app.core import storage
from app.models.recordings import Recording
from app.services import settings
from app.utils.paths import resolve_user_path

log = logging.getLogger(__name__)

SIDECAR_SUFFIX = ".yaml"


def raw_dir() -> Path:
    return resolve_user_path(settings.get_settings().storage.raw_path)


def mcap_path(root: Path, rec: Recording) -> Path:
    return root / rec.file


def sidecar_path(root: Path, rec: Recording) -> Path:
    return mcap_path(root, rec).with_suffix(SIDECAR_SUFFIX)


def _to_yaml(rec: Recording) -> dict:
    data = rec.model_dump(mode="json")
    data["topics"] = [
        {"name": t.pop("name"), "schema": t.pop("schema_"), **t} for t in data["topics"]
    ]
    return data


def write_sidecar(root: Path, rec: Recording) -> None:
    storage.write_file(sidecar_path(root, rec), storage.dumps(_to_yaml(rec)))


def write_mcap(root: Path, rec: Recording, data: bytes) -> None:
    storage.write_file(mcap_path(root, rec), data)


def remove(root: Path, rec: Recording) -> None:
    mcap_path(root, rec).unlink(missing_ok=True)
    sidecar_path(root, rec).unlink(missing_ok=True)


def load_all(root: Path) -> list[Recording]:
    """Every valid sidecar in <root>/*/*.yaml; broken ones are logged and skipped."""
    if not root.is_dir():
        return []
    out: list[Recording] = []
    for p in sorted(root.glob(f"*/*{SIDECAR_SUFFIX}")):
        if p.name.startswith(".") or p.parent.name.startswith("."):
            continue
        try:
            raw = storage.read_file(p)
            if not isinstance(raw, dict):
                raise ValueError("expected a mapping")
            file = p.relative_to(root).with_suffix(".mcap").as_posix()
            out.append(Recording.model_validate({**raw, "file": file}))
        except (OSError, storage.StorageError, ValidationError, ValueError) as e:
            log.warning("%s is invalid, skipping it: %s", p, e)
    return out


def unique_name(folder: Path, name: str) -> str:
    """name, or name-2.mcap, name-3.mcap … when an MCAP or sidecar already uses it."""
    stem, suffix = Path(name).stem, Path(name).suffix
    candidate, n = name, 1
    while (folder / candidate).exists() or (folder / candidate).with_suffix(
        SIDECAR_SUFFIX
    ).exists():
        n += 1
        candidate = f"{stem}-{n}{suffix}"
    return candidate

"""Saved models: folders under config.models_dir/<id>/ (no mocks).

A model folder holds model.yaml (the Model fields in snake_case, minus id / size / local path)
next to the checkpoint files (e.g. pretrained_model/model.safetensors). The index is rebuilt by
scanning on reset; id = folder name, sizeMB = all files, localPath = the folder.
"""

import logging
import shutil
from pathlib import Path
from typing import Literal

from pydantic import ValidationError

from app.configs.config import config
from app.core import storage
from app.core.errors import ApiError, not_found
from app.models.models import Model, ModelEval
from app.schemas.models import ModelFile, ModelPush
from app.services import settings
from app.utils.time import now_iso

log = logging.getLogger(__name__)

SIDECAR = "model.yaml"
_DERIVED = ("id", "size_mb", "local_path")

_models: dict[str, Model] = {}


def reset() -> None:
    _models.clear()
    root = config.models_dir
    if not root.is_dir():
        return
    for d in sorted(p for p in root.iterdir() if p.is_dir() and not p.name.startswith(".")):
        if not (d / SIDECAR).is_file():
            continue
        try:
            _models[d.name] = _load(d)
        except (storage.StorageError, ValidationError, OSError, ValueError) as e:
            log.warning("%s is not a usable model folder, skipping it: %s", d, e)


def folder(model_id: str) -> Path:
    return config.models_dir / model_id


def _files(d: Path) -> list[Path]:
    return sorted(
        p for p in d.rglob("*") if p.is_file() and p.name != SIDECAR and not p.name.startswith(".")
    )


def _load(d: Path) -> Model:
    raw = storage.read_file(d / SIDECAR)
    if not isinstance(raw, dict):
        raise ValueError("expected a mapping")
    size_mb = round(sum(p.stat().st_size for p in _files(d)) / 1_000_000, 2)
    return Model.model_validate({**raw, "id": d.name, "size_mb": size_mb, "local_path": str(d)})


def _save(m: Model) -> None:
    data = m.model_dump(mode="json", by_alias=False, exclude=set(_DERIVED))
    try:
        storage.write_file(folder(m.id) / SIDECAR, storage.dumps(data))
    except OSError as e:
        raise ApiError(503, "Could not write to the models folder", {"reason": str(e)}) from e


def list_models(
    task_id: str | None = None, location: Literal["local", "hub"] | None = None
) -> list[Model]:
    items = [
        m
        for m in _models.values()
        if (task_id is None or m.task_id == task_id)
        and (location != "local" or m.local_path)
        and (location != "hub" or m.hub_repo)
    ]
    return sorted(items, key=lambda m: m.saved_at, reverse=True)


def get_model(model_id: str) -> Model | None:
    return _models.get(model_id)


def require_model(model_id: str) -> Model:
    m = _models.get(model_id)
    if m is None:
        raise not_found("Model", model_id)
    return m


def model_files(model_id: str) -> list[ModelFile]:
    require_model(model_id)
    d = folder(model_id)
    return [
        ModelFile(path=p.relative_to(d).as_posix(), size_mb=round(p.stat().st_size / 1_000_000, 2))
        for p in _files(d)
    ]


def add_model(model: Model) -> Model:
    """Registers a model whose folder (checkpoint files) the trainer has written."""
    model = model.model_copy(update={"local_path": str(folder(model.id))})
    _save(model)
    _models[model.id] = model
    return model


def rename(model_id: str, name: str) -> Model:
    m = require_model(model_id).model_copy(update={"name": name.strip()})
    _save(m)
    _models[model_id] = m
    return m


def delete(model_id: str) -> None:
    require_model(model_id)
    shutil.rmtree(folder(model_id), ignore_errors=True)
    del _models[model_id]


def secret_set(name: str) -> bool:
    return settings.has_secret(name)


def default_repo(task_id: str) -> str:
    return (
        f"{settings.get_settings().integrations.hf.namespace}/smolvla_{task_id.replace('-', '_')}"
    )


def download(model_id: str):
    require_model(model_id)
    raise ApiError(501, "Model download is not implemented yet")


def push(model_id: str, body: ModelPush | None = None) -> Model:
    m = require_model(model_id)
    repo = body.repo if body else None
    if not secret_set("hf_token"):
        raise ApiError(424, "Hugging Face token is not set")
    # Upload is not wired yet; record the target repo right away
    m = m.model_copy(update={"hub_repo": repo or m.hub_repo or default_repo(m.task_id)})
    _save(m)
    _models[model_id] = m
    return m


def record_trial(model_id: str, instruction: str, success: bool, session_start: str) -> ModelEval:
    """Adds one judged trial to the model's current eval (same session, day and instruction)."""
    m = require_model(model_id)
    now = now_iso()
    current = next(
        (
            e
            for e in reversed(m.evals)
            if e.instruction == instruction and e.at >= session_start and e.at[:10] == now[:10]
        ),
        None,
    )
    if current is None:
        current = ModelEval(at=now, trials=0, success=0, instruction=instruction)
        m.evals.append(current)
    current.trials += 1
    current.success += int(success)
    _save(m)
    return current


reset()

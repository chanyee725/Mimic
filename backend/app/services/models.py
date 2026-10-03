"""Saved model store (in memory, seeded from the web mocks)."""

from typing import Literal

from app.core.clock import iso, now_iso
from app.core.errors import ApiError, not_found
from app.seeds import load
from app.models.models import Model, ModelEval
from app.schemas.models import ModelFile, ModelPush
from app.services import settings

_models: dict[str, Model] = {}


def reset() -> None:
    _models.clear()
    for m in load("models", "MODELS"):
        m["savedAt"] = iso(m["savedAt"])
        for e in m["evals"]:
            e["at"] = iso(e["at"])
        _models[m["id"]] = Model.model_validate(m)


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
    return [ModelFile(path=f["path"], size_mb=f["sizeMB"]) for f in load("models", "MODEL_FILES")]


def add_model(model: Model) -> Model:
    """Used by training when a checkpoint is saved."""
    _models[model.id] = model
    return model


def rename(model_id: str, name: str) -> Model:
    m = require_model(model_id)
    m.name = name.strip()
    return m


def delete(model_id: str) -> None:
    require_model(model_id)
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
    m.hub_repo = repo or m.hub_repo or default_repo(m.task_id)
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
    return current


reset()

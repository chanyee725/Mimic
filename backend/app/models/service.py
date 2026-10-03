"""Saved model store (in memory, seeded from the web mocks)."""

from app.core.clock import iso
from app.core.seed import load
from app.models.schemas import Model, ModelFile

_models: dict[str, Model] = {}


def reset() -> None:
    _models.clear()
    for m in load("models", "MODELS"):
        m["sizeMb"] = m.pop("sizeMB")
        m["savedAt"] = iso(m["savedAt"])
        for e in m["evals"]:
            e["at"] = iso(e["at"])
        _models[m["id"]] = Model.model_validate(m)


def list_models() -> list[Model]:
    return sorted(_models.values(), key=lambda m: m.saved_at, reverse=True)


def get_model(model_id: str) -> Model | None:
    return _models.get(model_id)


def model_files() -> list[ModelFile]:
    return [ModelFile(path=f["path"], size_mb=f["sizeMB"]) for f in load("models", "MODEL_FILES")]


reset()

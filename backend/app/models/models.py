"""Saved model entities and their evaluation records."""

from pydantic import Field

from app.schemas.common import CamelModel


class ModelEval(CamelModel):
    at: str
    trials: int
    success: int
    instruction: str


class Model(CamelModel):
    id: str
    name: str
    task_id: str
    dataset: str
    job_id: str
    step: int
    loss: float
    size_mb: float = Field(alias="sizeMB")
    saved_at: str
    local_path: str | None = None
    hub_repo: str | None = None
    evals: list[ModelEval] = []

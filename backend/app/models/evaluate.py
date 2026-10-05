"""Real-robot evaluation run entity."""

from typing import Literal

from app.schemas.common import CamelModel

EvalRunState = Literal["loading", "running", "judging", "done"]


class EvalRun(CamelModel):
    id: str
    model_id: str
    instruction: str
    limit_s: float | None = None
    record: bool
    state: EvalRunState
    started_at: str
    elapsed_s: float
    result: Literal["success", "fail"] | None = None
    error: str | None = None  # why the run ended early (camera lost, policy or robot error)

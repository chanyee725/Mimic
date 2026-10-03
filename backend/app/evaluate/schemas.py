from typing import Literal

from pydantic import Field

from app.core.schemas import CamelModel

EvalRunState = Literal["running", "judging", "done"]


class EvalRun(CamelModel):
    id: str
    model_id: str
    instruction: str
    limit_s: float
    record: bool
    state: EvalRunState
    started_at: str
    elapsed_s: float
    result: Literal["success", "fail"] | None = None


class EvalRunCreate(CamelModel):
    model_id: str
    instruction: str = Field(min_length=1, max_length=500)
    limit_s: float = Field(gt=0, le=3600)
    record: bool = False


class EvalResult(CamelModel):
    result: Literal["success", "fail", "discard"]

from typing import Literal

from pydantic import Field

from app.schemas.common import CamelModel


class EvalRunCreate(CamelModel):
    model_id: str
    instruction: str = Field(min_length=1, max_length=500)
    # Optional time limit; without one the run goes until Stop (MAX_RUN_S at most)
    limit_s: float | None = Field(None, gt=0, le=3600)
    # Speed limit in % of the servos' top speed; None (default) sends the policy's actions as they are
    speed_pct: float | None = Field(None, gt=0, le=100)
    record: bool = False


class EvalResult(CamelModel):
    result: Literal["success", "fail", "discard"]

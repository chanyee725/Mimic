from typing import Literal

from pydantic import Field

from app.schemas.common import CamelModel


class EvalRunCreate(CamelModel):
    model_id: str
    instruction: str = Field(min_length=1, max_length=500)
    limit_s: float = Field(gt=0, le=3600)
    record: bool = False


class EvalResult(CamelModel):
    result: Literal["success", "fail", "discard"]

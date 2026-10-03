from typing import Literal

from pydantic import Field

from app.schemas.common import CamelModel
from app.models.tasks import Outcome

CapturePhase = Literal["idle", "countdown", "recording", "review"]

# Operators are pseudonymous IDs only (no names or emails)
OperatorId = Field(pattern=r"^OP-\d{2,}$")


class CaptureState(CamelModel):
    phase: CapturePhase
    task_id: str | None = None
    operator: str | None = None
    episode_id: str | None = None
    started_at: str | None = None
    elapsed_s: float = 0
    subtask_index: int | None = None
    next_episode: int = 1


class StartBody(CamelModel):
    task_id: str
    operator: str = OperatorId


class SubtaskBody(CamelModel):
    index: int = Field(ge=0)


class SaveBody(CamelModel):
    outcome: Outcome

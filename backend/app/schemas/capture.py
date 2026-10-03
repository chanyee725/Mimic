from pydantic import Field

from app.schemas.common import CamelModel
from app.schemas.tasks import Outcome

# Operators are pseudonymous IDs only (no names or emails)
OperatorId = Field(pattern=r"^OP-\d{2,}$")


class StartBody(CamelModel):
    task_id: str
    operator: str = OperatorId


class SubtaskBody(CamelModel):
    index: int = Field(ge=0)


class SaveBody(CamelModel):
    outcome: Outcome

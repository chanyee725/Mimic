from pydantic import Field

from app.schemas.common import CamelModel
from app.models.tasks import Outcome


class StartBody(CamelModel):
    task_id: str


class SubtaskBody(CamelModel):
    index: int = Field(ge=0)


class SaveBody(CamelModel):
    outcome: Outcome

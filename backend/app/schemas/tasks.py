"""Task API shapes: create / update / duplicate bodies."""

from pydantic import Field

from app.models.tasks import SLUG, TaskFields
from app.schemas.common import CamelModel


class TaskInput(TaskFields):
    id: str = Field(pattern=SLUG)


class TaskUpdate(TaskFields):
    # id is immutable; if sent it must match the path
    version: int


class TaskDuplicate(CamelModel):
    id: str = Field(pattern=SLUG)
    name: str = Field(min_length=1)

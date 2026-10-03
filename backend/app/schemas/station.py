"""Station API shapes."""

from app.schemas.common import CamelModel


class DayCount(CamelModel):
    date: str
    count: int


class CurrentTask(CamelModel):
    task_id: str | None

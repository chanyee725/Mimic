"""Station API shapes."""

from app.schemas.common import CamelModel


class DayTask(CamelModel):
    task_id: str | None  # None: recordings without a task
    name: str
    count: int
    success: int
    fail: int
    seconds: float


class DayCount(CamelModel):
    date: str
    count: int
    seconds: float = 0  # recorded duration that day
    tasks: list[DayTask] = []  # what was recorded, most episodes first


class CurrentTask(CamelModel):
    task_id: str | None

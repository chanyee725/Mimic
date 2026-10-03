from typing import Literal

from app.schemas.common import CamelModel


class Station(CamelModel):
    id: str
    robot: str
    date: str


class DataTotal(CamelModel):
    key: Literal["episodes", "frames", "hours", "storage", "success"]
    label: str
    value: str


class DayCount(CamelModel):
    date: str
    count: int


class CurrentTask(CamelModel):
    task_id: str | None

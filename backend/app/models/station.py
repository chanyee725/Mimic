"""Station entities."""

from typing import Literal

from app.schemas.common import CamelModel

TotalKey = Literal["episodes", "frames", "hours", "storage", "success"]


class Station(CamelModel):
    id: str
    robot: str
    date: str


class DataTotal(CamelModel):
    key: TotalKey
    label: str
    value: str

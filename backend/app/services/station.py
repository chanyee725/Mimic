"""Station info and dashboard numbers (in memory, seeded from the web mocks)."""

from datetime import date, timedelta

from app.core.errors import not_found
from app.core.events import bus
from app.seeds import load
from app.models.station import DataTotal, Station
from app.schemas.station import CurrentTask, DayCount
from app.services.tasks import get_task
from app.utils.time import days, week_start

_state: dict = {}


def reset() -> None:
    _state.clear()
    _state["station"] = Station.model_validate(load("station", "STATION"))
    _state["totals"] = [DataTotal.model_validate(t) for t in load("station", "DATA_TOTALS")]
    _state["activity"] = {d["date"]: d["count"] for d in load("activity", "EPISODE_ACTIVITY")}
    _state["warnings"] = list(load("devices", "STATION_WARNINGS"))
    _state["current_task"] = load("station", "CURRENT_TASK_ID")


def get_station() -> Station:
    return _state["station"]


def totals() -> list[DataTotal]:
    return list(_state["totals"])


def activity(weeks: int) -> list[DayCount]:
    """One entry per day from the Sunday `weeks - 1` weeks back up to the station's today."""
    end = date.fromisoformat(get_station().date)
    start = week_start(end) - timedelta(weeks=weeks - 1)
    counts: dict[str, int] = _state["activity"]
    return [
        DayCount(date=d.isoformat(), count=counts.get(d.isoformat(), 0)) for d in days(start, end)
    ]


def warnings() -> list[str]:
    return list(_state["warnings"])


def current_task() -> CurrentTask:
    task_id = _state["current_task"]
    # A deleted task falls back to none
    return CurrentTask(task_id=task_id if task_id and get_task(task_id) else None)


def set_current_task(task_id: str | None) -> CurrentTask:
    if task_id is not None and get_task(task_id) is None:
        raise not_found("Task", task_id)
    _state["current_task"] = task_id
    cur = CurrentTask(task_id=task_id)
    bus.publish("station.current_task", cur)
    return cur


reset()

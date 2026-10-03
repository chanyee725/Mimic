"""Station info and dashboard numbers (in memory, seeded from the web mocks)."""

from datetime import date, timedelta

from app.core.errors import not_found
from app.core.events import bus
from app.core.seed import load
from app.station.schemas import CurrentTask, DataTotal, DayCount, Station
from app.tasks.service import get_task

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
    sunday = end - timedelta(days=(end.weekday() + 1) % 7)
    start = sunday - timedelta(weeks=weeks - 1)
    counts: dict[str, int] = _state["activity"]
    days = (end - start).days + 1
    out = []
    for i in range(days):
        d = (start + timedelta(days=i)).isoformat()
        out.append(DayCount(date=d, count=counts.get(d, 0)))
    return out


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

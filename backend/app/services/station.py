"""Station info and dashboard numbers, computed from the rigs, recordings and data folder."""

from collections import Counter
from datetime import timedelta

from app.configs.config import config
from app.core.errors import not_found
from app.core.events import bus
from app.models.recordings import Recording
from app.models.station import DataTotal, Station
from app.schemas.station import CurrentTask, DayCount, DayTask
from app.services import recordings, rigs
from app.services.settings import system
from app.services.tasks import get_task, list_tasks
from app.utils.time import days, parse_iso, today, tz, week_start

DISK_WARN_PCT = 90
NO_RIG = "No rig"

_state: dict = {}


def reset() -> None:
    _state.clear()
    _state["current_task"] = None


def _rig_name() -> str:
    """Rig of the current task, else the first rig."""
    task = get_task(_state["current_task"]) if _state["current_task"] else None
    rig = rigs.get_rig(task.rig_id) if task else None
    if rig is None:
        all_rigs = rigs.list_rigs()
        rig = all_rigs[0] if all_rigs else None
    return rig.name if rig else NO_RIG


def get_station() -> Station:
    return Station(id=config.station_id, robot=_rig_name(), date=today().isoformat())


def _fps(rec: Recording, task_fps: dict[str, int]) -> int:
    """Camera fps of the recording's task, else of its rig; 0 when neither is known."""
    if rec.task_id in task_fps:
        return task_fps[rec.task_id]
    rig = rigs.get_rig(rec.rig_id) if rec.rig_id else None
    return rig.target_hz.video if rig else 0


def _duration(seconds: float) -> str:
    """Minutes under an hour, else hours; one decimal."""
    minutes = round(seconds / 60, 1)
    return f"{minutes:.1f} min" if minutes < 60 else f"{seconds / 3600:.1f} h"


def _size(size: int) -> str:
    """MB under a GB, else GB (binary units); one decimal."""
    mb = round(size / system.MB, 1)
    return f"{mb:.1f} MB" if mb < 1024 else f"{size / system.GB:.1f} GB"


def totals() -> list[DataTotal]:
    recs = recordings.list_recordings()
    task_fps = {t.id: t.video_fps for t in list_tasks()}
    seconds = sum(r.duration_s for r in recs)
    frames = sum(round(r.duration_s * _fps(r, task_fps)) for r in recs)
    reviewed = [r for r in recs if r.review != "pending"]
    success = sum(r.outcome == "success" for r in reviewed)
    pct = round(100 * success / len(reviewed)) if reviewed else 0
    return [
        DataTotal(key="episodes", label="Episodes", value=f"{len(recs):,}"),
        DataTotal(key="frames", label="Frames", value=f"{frames:,}"),
        DataTotal(key="hours", label="Duration", value=_duration(seconds)),
        DataTotal(key="storage", label="Storage", value=_size(system.dir_size(config.data_dir))),
        DataTotal(key="success", label="Success rate", value=f"{pct}%"),
    ]


def activity(weeks: int) -> list[DayCount]:
    """Recordings per station day, from the Sunday `weeks - 1` weeks back up to today, with what
    each day recorded per task (for the heatmap tooltip)."""
    end = today()
    start = week_start(end) - timedelta(weeks=weeks - 1)
    by_day: dict[str, list[Recording]] = {}
    for r in recordings.list_recordings():
        by_day.setdefault(parse_iso(r.recorded_at).astimezone(tz()).date().isoformat(), []).append(
            r
        )
    return [_day(d.isoformat(), by_day.get(d.isoformat(), [])) for d in days(start, end)]


def _day(date: str, recs: list[Recording]) -> DayCount:
    by_task: dict[str | None, list[Recording]] = {}
    for r in recs:
        by_task.setdefault(r.task_id, []).append(r)
    tasks = []
    for task_id, rows in by_task.items():
        task = get_task(task_id) if task_id else None
        outcomes = Counter(r.outcome for r in rows)
        tasks.append(
            DayTask(
                task_id=task_id,
                name=task.name if task else (task_id or "No task"),
                count=len(rows),
                success=outcomes["success"],
                fail=outcomes["fail"],
                seconds=round(sum(r.duration_s for r in rows), 1),
            )
        )
    tasks.sort(key=lambda t: (-t.count, t.name))
    return DayCount(
        date=date,
        count=len(recs),
        seconds=round(sum(r.duration_s for r in recs), 1),
        tasks=tasks,
    )


def warnings() -> list[str]:
    """Real conditions only: unconnected rig devices and a nearly full data disk."""
    out = []
    off = [d.name for d in rigs.list_devices() if d.health == "off"]
    if off:
        out.append(f"{len(off)} devices not connected: {', '.join(off)}")
    used = system.disk_used_pct()
    if used > DISK_WARN_PCT:
        out.append(f"Data disk {used:.0f}% full")
    return out


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

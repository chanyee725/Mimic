"""Capture state machine (in memory): idle → countdown → recording → review → idle.

Phases advance lazily from an injectable clock, so tests are deterministic.
"""

import asyncio
from collections.abc import Callable
from datetime import datetime

from app.utils import time as station_clock
from app.core.errors import ApiError, conflict, not_found
from app.core.events import bus
from app.models.capture import CaptureState
from app.models.recordings import Recording
from app.models.rigs import Rig
from app.models.tasks import Outcome, Task
from app.services import recordings, tasks
from app.services.capture_recording import Session, build_recording
from app.services.rigs import get_device, get_rig
from app.services.tasks import get_task

_clock: Callable[[], datetime] = station_clock.now
_session: Session | None = None
_last_task_id: str | None = None
_issued: dict[str, int] = {}  # last episode number handed out per task


def set_clock(fn: Callable[[], datetime] | None = None) -> None:
    """Tests inject a fake clock; None restores the station clock."""
    global _clock
    _clock = fn or station_clock.now


def reset() -> None:
    global _session, _last_task_id
    _session, _last_task_id = None, None
    _issued.clear()
    set_clock(None)


def _next_episode(task: Task) -> int:
    return max(task.collected, recordings.max_episode(task.id), _issued.get(task.id, 0)) + 1


def _tick() -> None:
    """Auto-stops a recording that reached the task duration."""
    s = _session
    if s is None or s.stopped_s is not None:
        return
    elapsed = (_clock() - s.recording_at).total_seconds()
    if elapsed >= s.task.duration_s:
        s.stopped_s = s.task.duration_s
        bus.publish("capture.state", _snapshot())


def _snapshot() -> CaptureState:
    s = _session
    if s is None:
        task = get_task(_last_task_id) if _last_task_id else None
        return CaptureState(
            phase="idle",
            task_id=_last_task_id,
            next_episode=_next_episode(task) if task else 1,
        )
    elapsed = (_clock() - s.recording_at).total_seconds()
    if s.stopped_s is not None:
        phase, elapsed = "review", s.stopped_s
    elif elapsed < 0:
        phase, elapsed = "countdown", 0.0
    else:
        phase = "recording"
    return CaptureState(
        phase=phase,
        task_id=s.task.id,
        operator=s.operator,
        episode_id=f"{s.task.id}-{s.episode}",
        started_at=s.recording_at.isoformat(timespec="milliseconds"),
        elapsed_s=round(elapsed, 3),
        subtask_index=s.marks[-1][0] if s.marks else None,
        next_episode=s.episode,
    )


def is_active() -> bool:
    """True while an episode is counting down, recording or awaiting review."""
    return _session is not None


def state() -> CaptureState:
    _tick()
    return _snapshot()


_last_phase: str | None = None


async def watch(period_s: float = 0.2) -> None:
    """Background loop: publish capture.state when the countdown ends or the duration runs out."""
    global _last_phase
    while True:
        _tick()
        phase = _snapshot().phase
        if phase != _last_phase:
            _last_phase = phase
            bus.publish("capture.state", _snapshot())
        await asyncio.sleep(period_s)


def _publish() -> CaptureState:
    st = _snapshot()
    bus.publish("capture.state", st)
    return st


def _require_phase(*phases: str) -> CaptureState:
    st = state()
    if st.phase not in phases:
        raise conflict(f"Not allowed while {st.phase}", phase=st.phase, allowed=list(phases))
    return st


def _check_devices(task: Task, rig: Rig) -> None:
    cams = [c.id for c in rig.cameras if c.key in task.cameras]
    off = [
        d
        for d in [*rig.devices, *rig.robots, *cams]
        if (dev := get_device(d)) is not None and dev.health == "off"
    ]
    if off:
        raise ApiError(503, "Rig devices are not connected", {"devices": off})


def _arm(task: Task, rig: Rig, operator: str, episode: int) -> None:
    global _session
    _session = Session(task=task, rig=rig, operator=operator, episode=episode, armed_at=_clock())
    if task.subtasks:
        _session.marks.append((0, 0.0))


def start(task_id: str, operator: str) -> CaptureState:
    _require_phase("idle")
    task = get_task(task_id)
    if task is None:
        raise not_found("Task", task_id)
    rig = get_rig(task.rig_id)
    if rig is None:
        raise not_found("Rig", task.rig_id)
    _check_devices(task, rig)
    _arm(task, rig, operator, _next_episode(task))
    return _publish()


def mark_subtask(index: int) -> CaptureState:
    st = _require_phase("recording")
    s = _session
    assert s is not None
    if index >= len(s.task.subtasks):
        raise ApiError(
            422, "Subtask index out of range", {"index": index, "subtasks": len(s.task.subtasks)}
        )
    s.marks.append((index, st.elapsed_s))
    return _publish()


def stop() -> CaptureState:
    st = _require_phase("recording")
    assert _session is not None
    _session.stopped_s = st.elapsed_s
    return _publish()


def rerecord() -> CaptureState:
    _require_phase("countdown", "recording", "review")
    s = _session
    assert s is not None
    _arm(s.task, s.rig, s.operator, s.episode)
    return _publish()


def discard() -> CaptureState:
    global _session, _last_task_id
    st = _require_phase("countdown", "recording", "review")
    _session, _last_task_id = None, st.task_id
    return _publish()


def save(outcome: Outcome) -> Recording:
    """Writes the episode (recording → review implicitly) and returns to idle."""
    global _session, _last_task_id
    st = _require_phase("recording", "review")
    s = _session
    assert s is not None
    duration = max(0.1, round(s.stopped_s if s.stopped_s is not None else st.elapsed_s, 1))
    rec = recordings.add(build_recording(s, duration, outcome))
    tasks.bump_collected(s.task.id)
    _issued[s.task.id] = s.episode
    _session, _last_task_id = None, s.task.id
    _publish()
    return rec

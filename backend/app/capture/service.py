"""Capture state machine (in memory): idle → countdown → recording → review → idle.

Phases advance lazily from an injectable clock, so tests are deterministic.
"""

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from app.capture.schemas import CaptureState
from app.core import clock as station_clock
from app.core.errors import ApiError, conflict, not_found
from app.core.events import bus
from app.recordings import service as recordings
from app.recordings.schemas import McapTopic, Recording, RecordingCheck, SubtaskSpan
from app.rigs.schemas import Rig
from app.rigs.service import get_device, get_rig
from app.tasks.schemas import Outcome, Task
from app.tasks import service as tasks
from app.tasks.service import get_task

# Rough MCAP size model (matches the seeded recordings: ~1.9 MB/s with two cameras)
_MB_PER_CAMERA_S = 0.9
_MB_PER_JOINT_TOPIC_S = 0.05


@dataclass
class _Session:
    task: Task
    rig: Rig
    operator: str
    episode: int
    armed_at: datetime  # Start pressed; recording begins after the countdown
    marks: list[tuple[int, float]] = field(default_factory=list)  # (subtask index, seconds)
    stopped_s: float | None = None  # set once in review

    @property
    def recording_at(self) -> datetime:
        return self.armed_at + timedelta(seconds=self.task.countdown_s)


_clock: Callable[[], datetime] = station_clock.now
_session: _Session | None = None
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
        started_at=s.recording_at.isoformat(timespec="seconds"),
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
    _session = _Session(task=task, rig=rig, operator=operator, episode=episode, armed_at=_clock())
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
    rec = recordings.add(_build_recording(s, duration, outcome))
    tasks.bump_collected(s.task.id)
    _issued[s.task.id] = s.episode
    _session, _last_task_id = None, s.task.id
    _publish()
    return rec


def _spans(s: _Session, duration: float) -> list[SubtaskSpan]:
    marks: list[tuple[int, float]] = []
    for idx, t in sorted(s.marks, key=lambda m: m[1]):
        if t >= duration:
            continue
        if marks and marks[-1][1] == t:
            marks[-1] = (idx, t)  # last press at the same instant wins
        elif not marks or marks[-1][0] != idx:
            marks.append((idx, t))
    ends = [t for _, t in marks[1:]] + [duration]
    return [
        SubtaskSpan(name=s.task.subtasks[idx].name, start_s=t, end_s=end)
        for (idx, t), end in zip(marks, ends)
    ]


def _build_recording(s: _Session, duration: float, outcome: Outcome) -> Recording:
    task, rig = s.task, s.rig
    prefix = rig.id.split("-")[0]
    n_action = round(duration * task.action_hz)
    n_frames = round(duration * task.video_fps)
    topics = [
        McapTopic(
            name=f"/{prefix}_{d}/action",
            schema_="vla.robot.JointCommand",
            kind="action",
            rate_hz=task.action_hz,
            messages=n_action,
        )
        for d in rig.devices
    ]
    topics += [
        McapTopic(
            name=f"/{prefix}_{r}/state",
            schema_="vla.robot.JointState",
            kind="state",
            rate_hz=task.action_hz,
            messages=n_action,
        )
        for r in rig.robots
    ]
    topics += [
        McapTopic(
            name=f"/cam_{cam}/image",
            schema_="foxglove.CompressedVideo",
            kind="video",
            rate_hz=task.video_fps,
            messages=n_frames,
        )
        for cam in task.cameras
    ]
    spans = _spans(s, duration)
    if task.subtasks:
        topics.append(
            McapTopic(
                name="/labels/subtask",
                schema_="vla.session.SubtaskEvent",
                kind="label",
                rate_hz=None,
                messages=len(spans),
            )
        )
    topics.append(
        McapTopic(
            name="/labels/outcome",
            schema_="vla.session.OutcomeEvent",
            kind="label",
            rate_hz=None,
            messages=1,
        )
    )
    checks = [
        RecordingCheck(label="Action samples", value=f"{n_action} / {n_action}", ok=True),
        RecordingCheck(label="Video frames", value=f"{n_frames} / {n_frames}", ok=True),
        RecordingCheck(
            label="Timestamp gap", value=f"max {round(1000 / task.action_hz)} ms", ok=True
        ),
    ]
    if task.subtasks:
        done = len({sp.name for sp in spans})
        checks.append(
            RecordingCheck(label="Subtasks", value=f"{done} / {len(task.subtasks)}", ok=True)
        )
    joint_topics = len(rig.devices) + len(rig.robots)
    size = duration * (_MB_PER_CAMERA_S * len(task.cameras) + _MB_PER_JOINT_TOPIC_S * joint_topics)
    return Recording(
        id=f"{task.id}-{s.episode}",
        file=f"{task.id}/ep_{s.episode:04d}.mcap",
        source="capture",
        task_id=task.id,
        rig_id=rig.id,
        episode=s.episode,
        recorded_at=s.recording_at.isoformat(timespec="seconds"),
        duration_s=duration,
        size_mb=round(size, 1),
        outcome=outcome,
        review="pending",
        topics=topics,
        subtasks=spans,
        drops=[],
        checks=checks,
    )

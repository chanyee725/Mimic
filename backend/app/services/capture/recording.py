"""Capture session record and the Recording built from it on save."""

from dataclasses import dataclass, field
from datetime import datetime, timedelta

from app.models.recordings import McapTopic, Recording, RecordingCheck, SubtaskSpan
from app.models.rigs import Rig
from app.models.tasks import Outcome, Task
from app.utils.time import to_iso

# Rough MCAP size model (matches the seeded recordings: ~1.9 MB/s with two cameras)
_MB_PER_CAMERA_S = 0.9
_MB_PER_JOINT_TOPIC_S = 0.05


@dataclass
class Session:
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


def _spans(s: Session, duration: float) -> list[SubtaskSpan]:
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


def build_recording(s: Session, duration: float, outcome: Outcome) -> Recording:
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
        recorded_at=to_iso(s.recording_at),
        duration_s=duration,
        size_mb=round(size, 1),
        outcome=outcome,
        review="pending",
        topics=topics,
        subtasks=spans,
        drops=[],
        checks=checks,
    )

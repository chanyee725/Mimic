"""Capture session record and the Recording + MCAP content built from it on save."""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any

from app.models.recordings import Recording, RecordingCheck, SubtaskSpan
from app.models.rigs import Rig
from app.models.tasks import Outcome, Task
from app.services.recordings.mcap_io import Episode, topics
from app.utils.rng import unit_seed
from app.utils.time import to_iso


@dataclass
class Session:
    task: Task
    rig: Rig
    episode: int
    armed_at: datetime  # Start pressed; recording begins after the countdown
    marks: list[tuple[int, float]] = field(default_factory=list)  # (subtask index, seconds)
    stopped_s: float | None = None  # set once in review
    # Camera key → recorder (app.services.rigs.cameras.Recorder) holding every frame since armed
    cameras: dict[str, Any] = field(default_factory=dict)

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


Samples = tuple[list[float], list[list[float]], list[list[float]]]


def _checks(task: Task, duration: float, samples: Samples | None) -> list[RecordingCheck]:
    period_ms = 1000 / task.action_hz
    if samples is None:
        n = round(duration * task.action_hz)
        return [
            RecordingCheck(label="Action samples", value=f"{n} / {n}", ok=True),
            RecordingCheck(label="State samples", value=f"{n} / {n}", ok=True),
            RecordingCheck(label="Timestamp gap", value=f"max {round(period_ms)} ms", ok=True),
        ]
    t = samples[0]
    expected = round(duration * task.action_hz)
    enough = len(t) >= 0.95 * expected
    gaps = [b - a for a, b in zip(t, t[1:])]
    # The window edges count too: a recording that starts late or stops early has a gap
    edges = [t[0], duration - t[-1]] if t else [duration]
    gap_ms = round(max([*gaps, *edges]) * 1000)
    return [
        RecordingCheck(label="Action samples", value=f"{len(t)} / {expected}", ok=enough),
        RecordingCheck(label="State samples", value=f"{len(samples[2])} / {expected}", ok=enough),
        RecordingCheck(label="Timestamp gap", value=f"max {gap_ms} ms", ok=gap_ms <= 3 * period_ms),
    ]


Frames = list[tuple[float, bytes]]


def _video_checks(task: Task, duration: float, videos: dict[str, Frames]) -> list[RecordingCheck]:
    expected = round(duration * task.video_fps)
    return [
        RecordingCheck(
            label=f"Video {key}", value=f"{len(f)} / {expected}", ok=len(f) >= 0.95 * expected
        )
        for key, f in videos.items()
    ]


def _drops(task: Task, videos: dict[str, Frames]) -> list[float]:
    """Seconds (from the start) where a camera's next frame came over 1.5 periods late."""
    limit = 1.5 / task.video_fps
    out = {
        round(a, 2)
        for frames in videos.values()
        for (a, _), (b, _) in zip(frames, frames[1:])
        if b - a > limit
    }
    return sorted(out)


def build_episode(
    s: Session,
    duration: float,
    outcome: Outcome,
    samples: Samples | None = None,
    videos: dict[str, Frames] | None = None,
) -> tuple[Recording, Episode]:
    """The Recording (sidecar) and the MCAP content of a saved episode.

    `samples` are the teleoperation samples of the recording window (leader action, follower
    state); without them (no device access) the file holds a mock trajectory. `videos` are the
    JPEG frames of each recorded camera in the window (t from the recording start).
    """
    videos = videos or {}
    task, rig = s.task, s.rig
    rec_id = f"{task.id}-{s.episode}"
    spans = _spans(s, duration)
    ep = Episode(
        start_ns=int(s.recording_at.timestamp() * 1e9),
        duration_s=duration,
        hz=task.action_hz,
        joints=list(rig.joints),
        seed=unit_seed(rec_id),
        subtasks=spans,
        samples=samples,
        videos=videos,
        metadata={
            "source": "teleop" if samples is not None else "mock",
            "recording_id": rec_id,
            "task_id": task.id,
            "rig_id": rig.id,
            "episode": str(s.episode),
            "outcome": outcome,
        },
    )
    checks = _checks(task, duration, samples) + _video_checks(task, duration, videos)
    if task.subtasks:
        done = len({sp.name for sp in spans})
        checks.append(
            RecordingCheck(label="Subtasks", value=f"{done} / {len(task.subtasks)}", ok=True)
        )
    rec = Recording(
        id=rec_id,
        file=f"{task.id}/ep_{s.episode:04d}.mcap",
        source="capture",
        task_id=task.id,
        rig_id=rig.id,
        sim_env=task.env_id,
        episode=s.episode,
        recorded_at=to_iso(s.recording_at),
        duration_s=duration,
        size_mb=0,  # set from the written file
        outcome=outcome,
        review="pending",
        topics=topics(ep),
        subtasks=spans,
        drops=_drops(task, videos),
        checks=checks,
    )
    return rec, ep

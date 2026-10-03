"""Capture session record and the Recording + MCAP content built from it on save."""

from dataclasses import dataclass, field
from datetime import datetime, timedelta

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


def build_episode(s: Session, duration: float, outcome: Outcome) -> tuple[Recording, Episode]:
    """The Recording (sidecar) and the MCAP content of a saved episode.

    No camera frames yet (cameras are mock): the file holds action, state and subtask labels.
    """
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
        metadata={
            "recording_id": rec_id,
            "task_id": task.id,
            "rig_id": rig.id,
            "episode": str(s.episode),
            "operator": s.operator,
            "outcome": outcome,
        },
    )
    n = ep.n_samples
    checks = [
        RecordingCheck(label="Action samples", value=f"{n} / {n}", ok=True),
        RecordingCheck(label="State samples", value=f"{n} / {n}", ok=True),
        RecordingCheck(
            label="Timestamp gap", value=f"max {round(1000 / task.action_hz)} ms", ok=True
        ),
    ]
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
        episode=s.episode,
        recorded_at=to_iso(s.recording_at),
        duration_s=duration,
        size_mb=0,  # set from the written file
        outcome=outcome,
        review="pending",
        topics=topics(ep),
        subtasks=spans,
        drops=[],
        checks=checks,
    )
    return rec, ep

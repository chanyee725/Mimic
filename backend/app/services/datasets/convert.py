"""Convert: a task's accepted MCAP recordings → a LeRobot v3.0 dataset.

Each frame is sampled at dataset fps (= task video fps) from /action and /observation/state,
holding the latest message at or before the frame time (action is downsampled from the action
rate). /subtask spans become subtask_index (-1 outside every span).
"""

import math
from pathlib import Path
from typing import Any

import numpy as np

from app.core.errors import ApiError
from app.models.datasets import Dataset, DatasetFeature, Hub
from app.models.recordings import Recording
from app.models.tasks import Task
from app.schemas.datasets import ConvertPreview
from app.services import recordings
from app.services.datasets import datasets as store
from app.services.datasets import lerobot as lr
from app.services.rigs import get_rig
from app.services.tasks import require_task
from app.utils.ids import split_csv
from app.utils.time import now_iso

EST_OUTPUT_RATIO = 0.6  # LeRobot output vs. MCAP input size (preview estimate only)
_EPS = 1e-9


def sources(task_id: str, exclude: list[str]) -> list[Recording]:
    """Accepted recordings of the task minus exclude, oldest episode first."""
    skip = set(exclude)
    recs = [
        r
        for r in recordings.list_recordings(task_id)
        if r.review == "accepted" and r.id not in skip
    ]
    return sorted(recs, key=lambda r: (r.episode or 0, r.recorded_at))


def lerobot_features(joints: list[str]) -> dict[str, dict[str, Any]]:
    """info.json features of a converted dataset (joint names as lerobot "<joint>.pos")."""
    names = [f"{j}.pos" for j in joints]
    return {
        "action": lr.feature("float32", [len(joints)], names),
        "observation.state": lr.feature("float32", [len(joints)], list(names)),
        **lr.default_features(),
        lr.SUBTASK_KEY: lr.feature("int64", [1]),
    }


def notes(task: Task) -> dict[str, str]:
    if task.action_hz == task.video_fps:
        return {}
    return {"action": f"{task.action_hz} Hz → {task.video_fps} Hz"}


def _joints(task: Task, recs: list[Recording]) -> list[str]:
    rig = get_rig(task.rig_id)
    if rig is not None:
        return list(rig.joints)
    for rec in recs[:1]:
        try:
            return recordings.read_episode(rec).joints
        except recordings.McapReadError:
            pass
    return []


def features_for(task: Task, recs: list[Recording] | None = None) -> list[DatasetFeature]:
    return store.api_features(lerobot_features(_joints(task, recs or [])), notes(task))


def preview(task_id: str, exclude_csv: str | None) -> ConvertPreview:
    task = require_task(task_id)
    recs = sources(task_id, split_csv(exclude_csv))
    fps = task.video_fps
    mcap_mb = round(sum(r.size_mb for r in recs), 1)
    dates = sorted(r.recorded_at for r in recs)
    return ConvertPreview(
        fps=fps,
        action_hz=task.action_hz,
        features=features_for(task, recs),
        episodes=len(recs),
        frames=sum(math.floor(r.duration_s * fps + _EPS) for r in recs),
        length_s=round(sum(r.duration_s for r in recs), 1),
        mcap_mb=mcap_mb,
        est_output_mb=round(mcap_mb * EST_OUTPUT_RATIO, 1),
        recorded_from=dates[0] if dates else None,
        recorded_to=dates[-1] if dates else None,
    )


# --- writing ---


def _hold(times: list[float], values: list[list[float]], at: np.ndarray) -> np.ndarray:
    """Latest sample at or before each time (the first one before the recording starts)."""
    idx = np.searchsorted(np.asarray(times), at + _EPS, side="right") - 1
    return np.asarray(values, dtype=np.float32)[np.clip(idx, 0, None)]


def episode_columns(
    ep: recordings.EpisodeData, fps: int, w: lr.Writer
) -> tuple[dict[str, Any], int]:
    """Frame columns of one episode (everything but the writer's index columns)."""
    end = max(ep.action[0][-1], ep.state[0][-1])
    n = math.floor(end * fps + 1e-6) + 1
    frame = np.arange(n, dtype=np.int64)
    at = frame / fps
    sub = np.full(n, lr.NO_SUBTASK, dtype=np.int64)
    for span in ep.subtasks:
        sub[(at >= span.start_s - _EPS) & (at < span.end_s - _EPS)] = w.subtask_index(span.name)
    feats = w.features
    return {
        "action": lr.column(_hold(*ep.action, at), feats["action"]),
        "observation.state": lr.column(_hold(*ep.state, at), feats["observation.state"]),
        "timestamp": lr.column(at.astype(np.float32), feats["timestamp"]),
        "frame_index": lr.column(frame, feats["frame_index"]),
        lr.SUBTASK_KEY: lr.column(sub, feats[lr.SUBTASK_KEY]),
    }, n


def _build(task: Task, recs: list[Recording]) -> store.Build:
    fps = task.video_fps

    def build(root: Path, progress) -> dict[str, Any]:
        w: lr.Writer | None = None
        joints: list[str] = []
        for i, rec in enumerate(recs):
            try:
                ep = recordings.read_episode(rec)
            except recordings.McapReadError as e:
                raise ValueError(f"{rec.file}: {e}") from e
            if w is None:
                joints = ep.joints
                w = lr.Writer(root, fps, lerobot_features(joints), robot_type=task.rig_id)
                task_idx = w.task_index(task.instruction)
                for s in task.subtasks:
                    w.subtask_index(s.name)
            elif ep.joints != joints:
                raise ValueError(f"{rec.file} has joints {ep.joints}, expected {joints}")
            cols, n = episode_columns(ep, fps, w)
            w.add_episode(cols, np.full(n, task_idx, dtype=np.int64))
            progress(min(99, (i + 1) * 100 // len(recs)))
        assert w is not None
        w.finish()
        return {
            "task_id": task.id,
            "rig_id": task.rig_id,
            "created_at": now_iso(),
            "hub": {"pushed": False, "private": True},
            "notes": notes(task),
            "episode_sources": [r.file for r in recs],
        }

    return build


def convert(task_id: str, repo_id: str, exclude: list[str]) -> Dataset:
    """Starts writing the dataset in the background (status converting → ready / failed)."""
    task = require_task(task_id)
    store.check_new(repo_id)
    recs = sources(task_id, exclude)
    if not recs:
        raise ApiError(422, "No accepted recordings to convert", {"taskId": task_id})
    ds = Dataset(
        kind="lerobot",
        repo_id=repo_id,
        task_id=task.id,
        rig_id=task.rig_id,
        format=store.FORMAT,
        fps=task.video_fps,
        status="converting",
        progress=0,
        created_at=now_iso(),
        size_gb=0,
        hub=Hub(pushed=False, private=True),
        features=features_for(task, recs),
        episode_count=0,
    )
    return store.start_job(ds, _build(task, recs))

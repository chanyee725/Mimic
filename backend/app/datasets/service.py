"""Dataset store (in memory, seeded from the web mocks). Episodes are kept apart for paging.

Conversion is simulated: step() advances progress; drive() calls it on a timer in the server.
"""

import asyncio
import re

from app.core.clock import iso, now_iso
from app.core.errors import ApiError, conflict, not_found
from app.core.events import bus
from app.core.schemas import Page, paginate
from app.core.seed import load
from app.datasets.schemas import ConvertPreview, Dataset, DatasetEpisode, DatasetFeature, Hub
from app.recordings.schemas import Recording
from app.recordings.service import list_recordings
from app.rigs.service import get_rig
from app.settings import service as settings
from app.tasks.schemas import Task
from app.tasks.service import get_task

_datasets: dict[str, Dataset] = {}
_episodes: dict[str, list[DatasetEpisode]] = {}
_jobs: dict[str, list[Recording]] = {}  # repoId → recordings being converted

EST_OUTPUT_RATIO = 0.6  # LeRobot output vs. MCAP input size
STEP_PCT = 10
# Seconds between simulated progress steps in the server; None disables the timer (tests)
auto_step_s: float | None = 1.0
_runners: set[asyncio.Task] = set()


def reset() -> None:
    _datasets.clear()
    _episodes.clear()
    _jobs.clear()
    for d in load("datasets", "DATASETS"):
        eps = d.pop("episodes")
        d["createdAt"] = iso(d["createdAt"])
        d["episodeCount"] = len(eps)
        _datasets[d["repoId"]] = Dataset.model_validate(d)
        _episodes[d["repoId"]] = [DatasetEpisode.model_validate(e) for e in eps]


def list_datasets() -> list[Dataset]:
    return sorted(_datasets.values(), key=lambda d: d.created_at, reverse=True)


def get_dataset(repo_id: str) -> Dataset | None:
    return _datasets.get(repo_id)


def dataset_episodes(repo_id: str) -> list[DatasetEpisode]:
    return _episodes.get(repo_id, [])


def require(repo_id: str) -> Dataset:
    ds = _datasets.get(repo_id)
    if ds is None:
        raise not_found("Dataset", repo_id)
    return ds


def search(kind: str | None, q: str | None) -> list[Dataset]:
    needle = (q or "").strip().lower()
    return [
        d
        for d in list_datasets()
        if (kind is None or d.kind == kind)
        and (not needle or needle in d.repo_id.lower() or needle in d.task_id.lower())
    ]


def page_episodes(repo_id: str, limit: int, cursor: str | None) -> Page[DatasetEpisode]:
    require(repo_id)
    return paginate(dataset_episodes(repo_id), limit, cursor)


# --- conversion ---


def _require_task(task_id: str) -> Task:
    task = get_task(task_id)
    if task is None:
        raise not_found("Task", task_id)
    return task


def _sources(task_id: str, exclude: list[str]) -> list[Recording]:
    """Accepted recordings of the task minus exclude, oldest episode first."""
    skip = set(exclude)
    recs = [r for r in list_recordings(task_id) if r.review == "accepted" and r.id not in skip]
    return sorted(recs, key=lambda r: (r.episode or 0, r.recorded_at))


def _shape_of(resolution: str) -> str:
    m = re.match(r"^\s*(\d+)\s*[x×]\s*(\d+)\s*$", resolution)
    return f"[{m.group(2)}, {m.group(1)}, 3]" if m else "[?, ?, 3]"


def features_for(task: Task) -> list[DatasetFeature]:
    """LeRobot v3.0 features, like web features/convert (action / state / one video per camera)."""
    rig = get_rig(task.rig_id)
    n = len(rig.joints) if rig else 0
    fps = task.video_fps
    note = f"{task.action_hz} Hz → {fps} Hz" if task.action_hz != fps else None
    feats = [
        DatasetFeature(key="action", dtype="float32", shape=f"[{n}]", note=note),
        DatasetFeature(key="observation.state", dtype="float32", shape=f"[{n}]"),
    ]
    cams = {c.key: c for c in rig.cameras} if rig else {}
    for key in task.cameras:
        cam = cams.get(key)
        feats.append(
            DatasetFeature(
                key=cam.feature if cam else f"observation.images.{key}",
                dtype="video",
                shape=_shape_of(cam.resolution) if cam else "[?, ?, 3]",
                note="AV1",
            )
        )
    feats.append(DatasetFeature(key="subtask_index", dtype="int64", shape="[1]"))
    feats.append(DatasetFeature(key="timestamp", dtype="float32", shape="[1]"))
    for key in ("frame_index", "episode_index", "task_index"):
        feats.append(DatasetFeature(key=key, dtype="int64", shape="[1]"))
    return feats


def _preview(task: Task, recs: list[Recording]) -> ConvertPreview:
    fps = task.video_fps
    mcap_mb = round(sum(r.size_mb for r in recs), 1)
    dates = sorted(r.recorded_at for r in recs)
    return ConvertPreview(
        fps=fps,
        action_hz=task.action_hz,
        features=features_for(task),
        episodes=len(recs),
        frames=sum(round(r.duration_s * fps) for r in recs),
        length_s=round(sum(r.duration_s for r in recs), 1),
        mcap_mb=mcap_mb,
        est_output_mb=round(mcap_mb * EST_OUTPUT_RATIO, 1),
        recorded_from=dates[0] if dates else None,
        recorded_to=dates[-1] if dates else None,
    )


def preview(task_id: str, exclude: list[str]) -> ConvertPreview:
    task = _require_task(task_id)
    return _preview(task, _sources(task_id, exclude))


def start_conversion(task_id: str, repo_id: str, exclude: list[str]) -> Dataset:
    task = _require_task(task_id)
    if repo_id in _datasets:
        raise conflict(f"Dataset '{repo_id}' already exists", repoId=repo_id)
    recs = _sources(task_id, exclude)
    if not recs:
        raise ApiError(422, "No accepted recordings to convert", {"taskId": task_id})
    ds = Dataset(
        kind="lerobot",
        repo_id=repo_id,
        task_id=task.id,
        rig_id=task.rig_id,
        format="LeRobot v3.0",
        fps=task.video_fps,
        status="converting",
        progress=0,
        created_at=now_iso(),
        size_gb=0,
        hub=Hub(pushed=False, private=True),
        features=features_for(task),
        episode_count=0,
    )
    _datasets[repo_id] = ds
    _episodes[repo_id] = []
    _jobs[repo_id] = recs
    bus.publish("dataset.updated", ds)
    return ds


def _finish(ds: Dataset, recs: list[Recording]) -> Dataset:
    eps = [
        DatasetEpisode(
            index=i, source=r.file, length_s=r.duration_s, frames=round(r.duration_s * ds.fps)
        )
        for i, r in enumerate(recs)
    ]
    _episodes[ds.repo_id] = eps
    out_mb = sum(r.size_mb for r in recs) * EST_OUTPUT_RATIO
    return ds.model_copy(
        update={
            "status": "ready",
            "progress": None,
            "episode_count": len(eps),
            "size_gb": round(out_mb / 1024, 2),
        }
    )


def step(repo_id: str | None = None, pct: int = STEP_PCT) -> list[Dataset]:
    """Advances running conversions (one or all) by pct; returns the updated datasets."""
    updated = []
    for rid in [repo_id] if repo_id else list(_jobs):
        recs = _jobs.get(rid)
        ds = _datasets.get(rid)
        if recs is None or ds is None:
            continue
        progress = min(100, (ds.progress or 0) + pct)
        if progress >= 100:
            ds = _finish(ds, recs)
            del _jobs[rid]
        else:
            ds = ds.model_copy(update={"progress": progress})
        _datasets[rid] = ds
        bus.publish("dataset.updated", ds)
        updated.append(ds)
    return updated


async def drive(repo_id: str) -> None:
    """Server-side timer that steps one conversion until it finishes."""
    while auto_step_s is not None and repo_id in _jobs:
        await asyncio.sleep(auto_step_s)
        step(repo_id)


def schedule(repo_id: str) -> None:
    """Starts drive() on the running loop unless the timer is disabled."""
    if auto_step_s is None:
        return
    task = asyncio.get_running_loop().create_task(drive(repo_id))
    _runners.add(task)
    task.add_done_callback(_runners.discard)


# --- hub and delete ---


def hf_token_set() -> bool:
    return settings.has_secret("hf_token")


def push(repo_id: str, private: bool) -> Dataset:
    """Marks the dataset as pushed; the real upload runs once the HF client exists."""
    ds = require(repo_id)
    if ds.status != "ready":
        raise conflict(f"Dataset is {ds.status}", status=ds.status)
    if not hf_token_set():
        raise ApiError(424, "Hugging Face token is not set", {"secret": "hf_token"})
    ds = ds.model_copy(update={"hub": Hub(pushed=True, private=private)})
    _datasets[repo_id] = ds
    bus.publish("dataset.updated", ds)
    return ds


def delete(repo_id: str) -> None:
    require(repo_id)
    del _datasets[repo_id]
    _episodes.pop(repo_id, None)
    _jobs.pop(repo_id, None)  # cancels a running conversion
    bus.publish("dataset.deleted", {"repoId": repo_id})


reset()

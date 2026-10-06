"""Merge: several ready LeRobot v3.0 datasets → one new dataset.

Sources must share fps, features (keys, dtypes, shapes, names) and rig. Episodes are copied in
source order and re-numbered, the global index restarts at 0, and task / subtask tables are
unioned with their indices remapped. Video features are re-encoded episode by episode from the
sources' video files (same layout as Convert).
"""

from collections.abc import Iterator
from pathlib import Path
from typing import Any

import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq

from app.core.errors import ApiError
from app.models.datasets import WORLDS, Dataset, Hub
from app.schemas.datasets import MergePreview, MergeSource
from app.services.datasets import datasets as store
from app.services.datasets import lerobot as lr
from app.utils.ids import split_csv
from app.utils.time import now_iso

MIXED = "mixed"  # taskId of a merge whose sources come from different tasks


def _shape(ft: dict[str, Any]) -> str:
    return f"{ft.get('dtype')} {list(ft.get('shape') or [])}"


def check(repo_ids: list[str]) -> tuple[list[Dataset], dict[str, dict[str, Any]], list[str]]:
    """Usable sources, their info.json, and human-readable problems ([] = mergeable)."""
    problems: list[str] = []
    if len(repo_ids) < 2:
        problems.append("Pick at least two datasets to merge")
    seen: set[str] = set()
    found: list[Dataset] = []
    infos: dict[str, dict[str, Any]] = {}
    for rid in repo_ids:
        if rid in seen:
            problems.append(f"Dataset '{rid}' is listed more than once")
            continue
        seen.add(rid)
        ds = store.get_dataset(rid)
        if ds is None:
            problems.append(f"Dataset '{rid}' does not exist")
        elif ds.status != "ready":
            problems.append(f"Dataset '{rid}' is not ready ({ds.status})")
        else:
            try:
                infos[rid] = lr.read_info(store.folder(rid))
                found.append(ds)
            except lr.FormatError as e:
                problems.append(f"Dataset '{rid}' could not be read: {e}")
    if len(found) < 2:
        return found, infos, problems

    first = found[0]
    if len({d.fps for d in found}) > 1:
        rates = ", ".join(f"{d.repo_id} {d.fps} fps" for d in found)
        problems.append(f"Frame rates differ: {rates}")
    if len({d.rig_id for d in found}) > 1:
        rigs = ", ".join(f"{d.repo_id} {d.rig_id}" for d in found)
        problems.append(f"Robots differ: {rigs}")
    base = infos[first.repo_id]["features"]
    for d in found[1:]:
        other = infos[d.repo_id]["features"]
        if extra := [k for k in other if k not in base]:
            problems.append(f"Features differ: {d.repo_id} has {', '.join(extra)}")
        if missing := [k for k in base if k not in other]:
            problems.append(f"Features differ: {d.repo_id} lacks {', '.join(missing)}")
        for k in base:
            if k not in other:
                continue
            a, b = base[k], other[k]
            if _shape(a) != _shape(b):
                problems.append(
                    f"Feature '{k}' differs: {first.repo_id} {_shape(a)}, {d.repo_id} {_shape(b)}"
                )
            elif a.get("names") != b.get("names"):
                problems.append(f"Feature '{k}' has different names in {d.repo_id}")
    return found, infos, problems


def preview(sources_csv: str | None) -> MergePreview:
    repo_ids = split_csv(sources_csv)
    found, _, problems = check(repo_ids)
    rates = {d.fps for d in found}
    return MergePreview(
        sources=[
            MergeSource(
                repo_id=d.repo_id,
                episodes=d.episode_count,
                frames=store.total_frames(d.repo_id),
                fps=d.fps,
                rig_id=d.rig_id,
                task_id=d.task_id,
            )
            for d in found
        ],
        fps=rates.pop() if len(rates) == 1 else None,
        episodes=sum(d.episode_count for d in found),
        frames=sum(store.total_frames(d.repo_id) for d in found),
        size_gb=round(sum(d.size_gb for d in found), 4),
        features=found[0].features if found else [],
        problems=problems,
    )


def _task_id(found: list[Dataset]) -> str:
    ids = {d.task_id for d in found}
    return ids.pop() if len(ids) == 1 else MIXED


def _remap(values: np.ndarray, table: np.ndarray) -> np.ndarray:
    """Old index → new index; negative values (no subtask) stay -1."""
    if not len(table):
        return np.full(len(values), lr.NO_SUBTASK, dtype=np.int64)
    return np.where(values >= 0, table[np.clip(values, 0, len(table) - 1)], lr.NO_SUBTASK)


def _episodes(table: pa.Table) -> list[pa.Table]:
    """Rows of one data file split per episode (in index order)."""
    table = table.sort_by("index")
    eps = lr.to_numpy(table.column("episode_index"))
    cuts = [0, *(np.nonzero(np.diff(eps))[0] + 1).tolist(), len(eps)]
    return [table.slice(a, b - a) for a, b in zip(cuts, cuts[1:]) if b > a]


class _SourceVideo:
    """Frames of one source video key, read forward through its files episode by episode."""

    def __init__(self, root: Path, key: str, fps: int) -> None:
        self.root, self.key, self.half = root, key, 0.5 / fps
        self._path: Path | None = None
        self._container: Any = None
        self._frames: Iterator[Any] | None = None
        self._pending: Any = None

    def episode(self, row: dict[str, Any]) -> Iterator[Any]:
        """Decoded frames of the episode's span (videos/<key>/from_timestamp…to_timestamp)."""
        import av

        k = self.key
        path = self.root / lr.VIDEO_PATH.format(
            video_key=k,
            chunk_index=row[f"videos/{k}/chunk_index"],
            file_index=row[f"videos/{k}/file_index"],
        )
        start, end = row[f"videos/{k}/from_timestamp"], row[f"videos/{k}/to_timestamp"]
        if path != self._path or (self._pending is not None and self._pending.time > start):
            self.close()
            self._container = av.open(str(path))
            self._frames = self._container.decode(video=0)
            self._path = path
        while True:
            frame = self._pending if self._pending is not None else next(self._frames, None)
            self._pending = None
            if frame is None:
                return
            t = frame.time or 0.0
            if t < start - self.half:
                continue
            if t >= end - self.half:
                self._pending = frame  # first frame of a later episode
                return
            yield frame

    def close(self) -> None:
        if self._container is not None:
            self._container.close()
        self._container = self._frames = self._pending = self._path = None


def _build(found: list[Dataset], infos: dict[str, dict[str, Any]]) -> store.Build:
    first = found[0]
    features = infos[first.repo_id]["features"]
    total = sum(d.episode_count for d in found) or 1

    def build(root: Path, progress) -> dict[str, Any]:
        w = lr.Writer(root, first.fps, features, infos[first.repo_id].get("robot_type"))
        episode_sources: list[str] = []
        for d in found:
            src = store.folder(d.repo_id)
            task_map = np.array(
                [w.task_index(t) for t in lr.read_names(src, lr.TASKS_PATH, "task")],
                dtype=np.int64,
            )
            sub_map = np.array(
                [w.subtask_index(s) for s in lr.read_names(src, lr.SUBTASKS_PATH, "subtask")],
                dtype=np.int64,
            )
            srcs = store.read_sidecar(src).get("episode_sources") or []
            before = w.episodes
            readers = {k: _SourceVideo(src, k, first.fps) for k in w.video_keys}
            rows = (
                {r["episode_index"]: r for r in lr.read_episodes(src).to_pylist()}
                if readers
                else {}
            )
            for path in lr.data_files(src):
                for piece in _episodes(pq.read_table(path)):
                    cols: dict[str, Any] = {
                        k: piece.column(k)
                        for k in features
                        if k not in lr.WRITER_KEYS and not lr.is_video(features[k])
                    }
                    if lr.SUBTASK_KEY in cols:
                        cols[lr.SUBTASK_KEY] = _remap(lr.to_numpy(cols[lr.SUBTASK_KEY]), sub_map)
                    old = int(piece.column("episode_index")[0].as_py())
                    videos = {k: r.episode(rows[old]) for k, r in readers.items()}
                    w.add_episode(cols, task_map[lr.to_numpy(piece.column("task_index"))], videos)
                    episode_sources.append(srcs[old] if old < len(srcs) else f"{d.repo_id}#{old}")
                    progress(min(99, len(episode_sources) * 100 // total))
            for r in readers.values():
                r.close()
            if (copied := w.episodes - before) != d.episode_count:
                raise ValueError(
                    f"{d.repo_id} has {copied} of {d.episode_count} episodes in its data files"
                )
        w.finish()
        return {
            "task_id": _task_id(found),
            "rig_id": first.rig_id,
            "created_at": now_iso(),
            "hub": {"pushed": False, "private": True},
            "notes": {f.key: f.note for f in first.features if f.note},
            "sources": [d.repo_id for d in found],
            "worlds": _worlds(found),
            "episode_sources": episode_sources,
        }

    return build


def _worlds(found: list[Dataset]) -> list[str]:
    seen = {w for d in found for w in d.worlds}
    return [w for w in WORLDS if w in seen]


def merge(sources: list[str], repo_id: str) -> Dataset:
    """Starts writing the merged dataset in the background (converting → ready / failed)."""
    store.check_new(repo_id)
    found, infos, problems = check(sources)
    if problems:
        raise ApiError(422, "Datasets cannot be merged", {"problems": problems})
    ds = Dataset(
        kind="lerobot",
        repo_id=repo_id,
        task_id=_task_id(found),
        rig_id=found[0].rig_id,
        format=store.FORMAT,
        fps=found[0].fps,
        status="converting",
        progress=0,
        created_at=now_iso(),
        size_gb=0,
        hub=Hub(pushed=False, private=True),
        features=found[0].features,
        episode_count=0,
        sources=[d.repo_id for d in found],
        worlds=_worlds(found),
    )
    return store.start_job(ds, _build(found, infos))

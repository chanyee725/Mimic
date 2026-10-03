"""Dataset index: LeRobot v3.0 folders under config.datasets_dir/<namespace>/<name>/ (no mocks).

The index is rebuilt by scanning meta/info.json on reset. Each folder also holds station.yaml
(task, rig, hub state, feature notes, merge sources, source of every episode). Conversions and
merges write into a hidden ".<name>.partial-*" folder in a background thread, which is renamed
to the final folder once complete.
"""

import logging
import os
import re
import shutil
import threading
import uuid
from collections.abc import Callable
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from app.configs.config import config
from app.core import storage
from app.core.errors import ApiError, conflict, not_found
from app.core.events import bus
from app.models.datasets import Dataset, DatasetEpisode, DatasetFeature, Hub
from app.schemas.common import Page, paginate
from app.schemas.datasets import REPO_ID
from app.services import settings
from app.services.datasets import lerobot as lr
from app.utils.time import from_timestamp

log = logging.getLogger(__name__)

SIDECAR = "station.yaml"
FORMAT = f"LeRobot {lr.CODEBASE_VERSION}"
UNKNOWN = "unknown"

_lock = threading.RLock()
_datasets: dict[str, Dataset] = {}
_frames: dict[str, int] = {}  # repoId → total_frames
_jobs: dict[str, "Job"] = {}  # repoId → running conversion / merge


class Cancelled(Exception):
    """The job's dataset was deleted or the store was reset."""


class Job:
    def __init__(self, repo_id: str) -> None:
        self.repo_id = repo_id
        self.cancel = threading.Event()
        self.thread: threading.Thread | None = None


def reset() -> None:
    with _lock:
        for job in _jobs.values():
            job.cancel.set()
        _jobs.clear()
        _datasets.clear()
        _frames.clear()
        _scan()


def folder(repo_id: str) -> Path:
    namespace, name = repo_id.split("/", 1)
    return config.datasets_dir / namespace / name


def _visible(root: Path) -> list[Path]:
    if not root.is_dir():
        return []
    return sorted(p for p in root.iterdir() if p.is_dir() and not p.name.startswith("."))


def _scan() -> None:
    for ns in _visible(config.datasets_dir):
        for d in _visible(ns):
            if not (d / lr.INFO_PATH).is_file():
                continue
            repo_id = f"{ns.name}/{d.name}"
            try:
                _datasets[repo_id], _frames[repo_id] = load(d, repo_id)
            except (lr.FormatError, storage.StorageError, ValidationError, OSError) as e:
                log.warning("%s is not a usable dataset, skipping it: %s", d, e)


def read_sidecar(root: Path) -> dict[str, Any]:
    raw = storage.read_file(root / SIDECAR)
    return raw if isinstance(raw, dict) else {}


def write_sidecar(root: Path, data: dict[str, Any]) -> None:
    storage.write_file(root / SIDECAR, storage.dumps(data))


def api_features(
    features: dict[str, dict[str, Any]], notes: dict[str, str] | None = None
) -> list[DatasetFeature]:
    notes = notes or {}
    return [
        DatasetFeature(
            key=k,
            dtype=str(ft.get("dtype")),
            shape="[" + ", ".join(str(s) for s in ft.get("shape") or []) + "]",
            note=notes.get(k),
        )
        for k, ft in features.items()
    ]


def load(root: Path, repo_id: str) -> tuple[Dataset, int]:
    """Dataset entry of a v3.0 folder (station.yaml optional) and its frame count."""
    info = lr.read_info(root)
    side = read_sidecar(root)
    hub = side.get("hub") or {}
    created = side.get("created_at") or from_timestamp((root / lr.INFO_PATH).stat().st_mtime)
    try:
        ds = Dataset(
            kind="lerobot",
            repo_id=repo_id,
            task_id=side.get("task_id") or UNKNOWN,
            rig_id=side.get("rig_id") or info.get("robot_type") or UNKNOWN,
            format=FORMAT,
            fps=int(info["fps"]),
            status="ready",
            created_at=created,
            size_gb=round(lr.folder_size(root) / 1024**3, 4),
            hub=Hub(pushed=bool(hub.get("pushed", False)), private=bool(hub.get("private", True))),
            features=api_features(info["features"], side.get("notes")),
            episode_count=int(info.get("total_episodes", 0)),
            sources=side.get("sources"),
        )
    except (KeyError, TypeError, ValueError) as e:
        raise lr.FormatError(f"info.json is incomplete: {e}") from e
    return ds, int(info.get("total_frames", 0))


# --- reads ---


def list_datasets() -> list[Dataset]:
    return sorted(_datasets.values(), key=lambda d: (d.created_at, d.repo_id), reverse=True)


def get_dataset(repo_id: str) -> Dataset | None:
    return _datasets.get(repo_id)


def require(repo_id: str) -> Dataset:
    ds = _datasets.get(repo_id)
    if ds is None:
        raise not_found("Dataset", repo_id)
    return ds


def total_frames(repo_id: str) -> int:
    return _frames.get(repo_id, 0)


def search(kind: str | None, q: str | None) -> list[Dataset]:
    needle = (q or "").strip().lower()
    return [
        d
        for d in list_datasets()
        if (kind is None or d.kind == kind)
        and (not needle or needle in d.repo_id.lower() or needle in d.task_id.lower())
    ]


def page_episodes(repo_id: str, limit: int, cursor: str | None) -> Page[DatasetEpisode]:
    """Episodes from meta/episodes; [] while the dataset is still being written."""
    ds = require(repo_id)
    if ds.status != "ready":
        return paginate([], limit, cursor)
    root = folder(repo_id)
    try:
        table = lr.read_episodes(root, ["episode_index", "length"])
        sources = read_sidecar(root).get("episode_sources") or []
    except (lr.FormatError, storage.StorageError, OSError, KeyError) as e:
        raise ApiError(500, "Dataset episodes could not be read", {"reason": str(e)}) from e
    rows = [
        DatasetEpisode(
            index=i,
            source=sources[i] if i < len(sources) else "",
            length_s=round(n / ds.fps, 3),
            frames=n,
        )
        for i, n in zip(
            table.column("episode_index").to_pylist(), table.column("length").to_pylist()
        )
    ]
    return paginate(rows, limit, cursor)


# --- background jobs (convert, merge) ---


def check_new(repo_id: str) -> None:
    if not re.match(REPO_ID, repo_id):
        raise ApiError(422, "repoId must look like <namespace>/<name>", {"repoId": repo_id})
    if repo_id in _datasets or folder(repo_id).exists():
        raise conflict(f"Dataset '{repo_id}' already exists", repoId=repo_id)


# build(tmp folder, progress(pct)) writes the dataset and returns the station.yaml content
Build = Callable[[Path, Callable[[int], None]], dict[str, Any]]


def start_job(ds: Dataset, build: Build) -> Dataset:
    """Registers ds as converting and runs build in a background thread."""
    with _lock:
        check_new(ds.repo_id)
        final = folder(ds.repo_id)
        tmp = final.parent / f".{final.name}.partial-{uuid.uuid4().hex[:8]}"
        job = Job(ds.repo_id)
        job.thread = threading.Thread(
            target=_run, args=(job, tmp, final, build), name=f"dataset:{ds.repo_id}", daemon=True
        )
        _datasets[ds.repo_id] = ds
        _jobs[ds.repo_id] = job
    bus.publish("dataset.updated", ds)
    job.thread.start()
    return ds


def _progress(job: Job, pct: int) -> None:
    with _lock:
        if job.cancel.is_set():
            raise Cancelled
        ds = _datasets.get(job.repo_id)
        if ds is None or ds.progress == pct:
            return
        ds = ds.model_copy(update={"progress": pct})
        _datasets[job.repo_id] = ds
    bus.publish("dataset.updated", ds)


def _run(job: Job, tmp: Path, final: Path, build: Build) -> None:
    try:
        tmp.mkdir(parents=True)
        side = build(tmp, lambda pct: _progress(job, pct))
        write_sidecar(tmp, side)
        with _lock:
            if job.cancel.is_set():
                raise Cancelled
            os.replace(tmp, final)
            ds, frames = load(final, job.repo_id)
            _datasets[job.repo_id], _frames[job.repo_id] = ds, frames
            _jobs.pop(job.repo_id, None)
    except Cancelled:
        shutil.rmtree(tmp, ignore_errors=True)
        return
    except Exception as e:  # any failure ends the job as "failed"
        log.exception("Dataset job %s failed", job.repo_id)
        shutil.rmtree(tmp, ignore_errors=True)
        with _lock:
            if job.cancel.is_set() or job.repo_id not in _datasets:
                return
            _jobs.pop(job.repo_id, None)
            ds = _datasets[job.repo_id].model_copy(
                update={"status": "failed", "progress": None, "error": str(e) or type(e).__name__}
            )
            _datasets[job.repo_id] = ds
    bus.publish("dataset.updated", ds)


def wait(repo_id: str, timeout: float = 30) -> Dataset:
    """Blocks until a running job ends (tests, scripts)."""
    job = _jobs.get(repo_id)
    if job is not None and job.thread is not None:
        job.thread.join(timeout)
    return require(repo_id)


# --- hub, thumbnail and delete ---


def thumbnail(repo_id: str) -> None:
    """Preview frame of a dataset; datasets have no video yet."""
    require(repo_id)
    raise ApiError(501, "Thumbnails are not available yet")


def hf_token_set() -> bool:
    return settings.has_secret("hf_token")


def push(repo_id: str, private: bool) -> Dataset:
    """Marks the dataset as pushed; the real upload runs once the HF client exists."""
    ds = require(repo_id)
    if ds.status != "ready":
        raise conflict(f"Dataset is {ds.status}", status=ds.status)
    if not hf_token_set():
        raise ApiError(424, "Hugging Face token is not set", {"secret": "hf_token"})
    hub = Hub(pushed=True, private=private)
    root = folder(repo_id)
    try:
        write_sidecar(root, {**read_sidecar(root), "hub": hub.model_dump()})
    except (OSError, storage.StorageError) as e:
        raise ApiError(503, "Could not write to the datasets folder", {"reason": str(e)}) from e
    with _lock:
        ds = ds.model_copy(update={"hub": hub})
        _datasets[repo_id] = ds
    bus.publish("dataset.updated", ds)
    return ds


def delete(repo_id: str) -> None:
    """Removes the folder; a running conversion or merge is cancelled."""
    with _lock:
        require(repo_id)
        job = _jobs.pop(repo_id, None)
        if job is not None:
            job.cancel.set()
        del _datasets[repo_id]
        _frames.pop(repo_id, None)
        root = folder(repo_id)
        if job is None and root.is_dir():
            shutil.rmtree(root)
    bus.publish("dataset.deleted", {"repoId": repo_id})

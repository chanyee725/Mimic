"""Recording store: episodes on disk under the raw folder (no mock data).

Every recording (Capture saves, imports) is an MCAP plus a YAML sidecar (disk.py); the
in-memory index is rebuilt from the sidecars whenever the raw folder changes.
"""

import math
import threading
import re
from pathlib import Path

from app.core.errors import ApiError, not_found
from app.core.events import bus
from app.schemas.common import Page, paginate
from app.models.rigs import RigKind
from app.models.recordings import (
    Recording,
    RecordingCheck,
    RecordingOrder,
    RecordingReview,
    RecordingSource,
)
from app.schemas.recordings import Samples
from app.services.recordings import disk
from app.services.recordings import mcap_io as recordings_mcap
from app.services.recordings.video import build_mp4
from app.utils.ids import slugify, split_csv
from app.utils.time import now_iso

_recordings: dict[str, Recording] = {}  # id → recording backed by an MCAP + sidecar under _root
_root: Path | None = None  # raw folder last scanned

MCAP_MAGIC = b"\x89MCAP0\r\n"
SAMPLE_TOPICS = ("action", "state")
MAX_SAMPLES = 100_000  # per joint and topic
IMPORTS_DIR = "imports"  # <raw>/imports/<name>.mcap


def reset() -> None:
    global _root
    _recordings.clear()
    _root = None
    _sync()


def _sync() -> Path:
    """Reloads the disk recordings when the raw folder setting changed; returns the folder."""
    global _root
    root = disk.raw_dir()
    if root == _root:
        return root
    _recordings.clear()
    for rec in disk.load_all(root):
        # Two sidecars with one id: the first by path wins
        _recordings.setdefault(rec.id, rec)
    _root = root
    return root


def is_on_disk(recording_id: str) -> bool:
    _sync()
    return recording_id in _recordings


def list_recordings(task_id: str | None = None) -> list[Recording]:
    _sync()
    rows = [r for r in _recordings.values() if task_id is None or r.task_id == task_id]
    return sorted(rows, key=lambda r: r.recorded_at, reverse=True)


def get_recording(recording_id: str) -> Recording | None:
    _sync()
    return _recordings.get(recording_id)


def require(recording_id: str) -> Recording:
    rec = get_recording(recording_id)
    if rec is None:
        raise not_found("Recording", recording_id)
    return rec


def page_recordings(
    task_id: str | None,
    review: RecordingReview | None,
    source: RecordingSource | None,
    limit: int,
    cursor: str | None,
    order: RecordingOrder = "newest",
    kind: RigKind | None = None,
) -> Page[Recording]:
    rows = [
        r
        for r in list_recordings(task_id)
        if (review is None or r.review == review)
        and (source is None or r.source == source)
        and (kind is None or (r.sim_env is not None) == (kind == "sim"))
    ]
    if order == "episode":
        # Lowest episode number first; imports (no number) last, oldest first
        rows.sort(key=lambda r: (r.episode is None, r.episode or 0, r.recorded_at))
    return paginate(rows, limit, cursor)


def _write_failed(e: OSError) -> ApiError:
    return ApiError(503, "Could not write to the raw folder", {"reason": str(e)})


def add(rec: Recording, data: bytes) -> Recording:
    """Writes a new recording (MCAP + sidecar) to the raw folder and announces it."""
    root = _sync()
    rec = rec.model_copy(update={"size_mb": round(len(data) / 1_000_000, 2)})
    try:
        disk.write_mcap(root, rec, data)
        disk.write_sidecar(root, rec)
    except OSError as e:
        disk.remove(root, rec)
        raise _write_failed(e) from e
    _recordings[rec.id] = rec
    bus.publish("recording.created", rec)
    return rec


def save_episode(rec: Recording, ep: recordings_mcap.Episode) -> Recording:
    """Capture save: writes the episode MCAP at <raw>/<task-id>/ep_<NNNN>.mcap."""
    return add(rec, recordings_mcap.encode(ep))


def max_episode(task_id: str) -> int:
    """Highest episode number in use, disk recordings included (never reused after restart)."""
    _sync()
    return max((r.episode or 0 for r in _recordings.values() if r.task_id == task_id), default=0)


def set_review(recording_id: str, review: RecordingReview) -> Recording:
    rec = require(recording_id).model_copy(update={"review": review})
    try:
        disk.write_sidecar(_sync(), rec)
    except OSError as e:
        raise _write_failed(e) from e
    _recordings[rec.id] = rec
    bus.publish("recording.updated", rec)
    return rec


def delete(recording_id: str) -> None:
    """Removes the MCAP and its sidecar."""
    rec = require(recording_id)
    disk.remove(_sync(), rec)
    del _recordings[recording_id]
    bus.publish("recording.deleted", {"id": recording_id})


def _require_all(ids: list[str]) -> list[Recording]:
    """Every id must exist; nothing changes otherwise (404 lists the missing ids)."""
    _sync()
    missing = [i for i in ids if i not in _recordings]
    if missing:
        raise ApiError(404, f"{len(missing)} recording(s) do not exist", {"missing": missing})
    return [_recordings[i] for i in dict.fromkeys(ids)]


def set_review_many(ids: list[str], review: RecordingReview) -> list[Recording]:
    """Bulk Accept / Reject: one `recording.reviewed` event for the whole set."""
    out: list[Recording] = []
    root = _sync()
    try:
        for rec in _require_all(ids):
            rec = rec.model_copy(update={"review": review})
            disk.write_sidecar(root, rec)
            _recordings[rec.id] = rec
            out.append(rec)
    except OSError as e:
        raise _write_failed(e) from e
    finally:
        if out:
            bus.publish("recording.reviewed", {"ids": [r.id for r in out], "review": review})
    return out


def delete_many(ids: list[str]) -> None:
    """Bulk delete: one `recording.deleted` event with every removed id."""
    root = _sync()
    done: list[str] = []
    try:
        for rec in _require_all(ids):
            disk.remove(root, rec)
            del _recordings[rec.id]
            done.append(rec.id)
    finally:
        if done:
            bus.publish("recording.deleted", {"ids": done})


def import_mcap(filename: str, data: bytes) -> Recording:
    """Stores an uploaded MCAP at <raw>/imports/<name>. Topics wait for the indexer."""
    if not filename.lower().endswith(".mcap"):
        raise ApiError(422, "Only .mcap files can be imported", {"filename": filename})
    if not data.startswith(MCAP_MAGIC):
        raise ApiError(422, "File is not a valid MCAP (bad magic bytes)", {"filename": filename})
    root = _sync()
    stem = slugify(filename[:-5]) or "file"
    rec_id, n = f"ext-{stem}", 1
    while rec_id in _recordings:
        n += 1
        rec_id = f"ext-{stem}-{n}"
    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", filename.rsplit("/", 1)[-1]).lstrip(".")
    if not safe_name[:-5]:
        safe_name = "file.mcap"
    safe_name = disk.unique_name(root / IMPORTS_DIR, safe_name)
    rec = Recording(
        id=rec_id,
        file=f"{IMPORTS_DIR}/{safe_name}",
        source="external",
        recorded_at=now_iso(),
        duration_s=0,
        size_mb=0,
        review="pending",
        topics=[],
        subtasks=[],
        drops=[],
        checks=[
            RecordingCheck(label="Metadata", value="missing task / rig", ok=False),
            RecordingCheck(label="Topics", value="not indexed yet", ok=False),
        ],
    )
    return add(rec, data)


def samples(
    recording_id: str, topics_csv: str, from_s: float, to_s: float | None, hz: float
) -> Samples:
    """Joint data read from the MCAP and resampled at hz."""
    rec = require(recording_id)
    topics = split_csv(topics_csv)
    bad = [t for t in topics if t not in SAMPLE_TOPICS]
    if bad or not topics:
        raise ApiError(422, f"topics must be a subset of {list(SAMPLE_TOPICS)}", {"topics": bad})
    end = rec.duration_s if to_s is None else min(to_s, rec.duration_s)
    if from_s > end:
        raise ApiError(422, "fromS must not exceed toS / duration", {"fromS": from_s, "toS": end})
    n = int(math.floor((end - from_s) * hz + 1e-9)) + 1
    if n > MAX_SAMPLES:
        raise ApiError(422, "Too many samples; narrow the window or lower hz", {"samples": n})
    ts = [round(from_s + k / hz, 6) for k in range(n)]
    channels = [recordings_mcap.SAMPLE_CHANNELS[t] for t in topics]
    try:
        data = recordings_mcap.read_joints(disk.mcap_path(_sync(), rec), channels)
    except recordings_mcap.McapReadError as e:
        raise ApiError(422, "Recording has no readable joint data", {"reason": str(e)}) from e
    series = {
        topic: recordings_mcap.resample(*data.series[channel], ts)
        for topic, channel in zip(topics, channels)
    }
    return Samples(joints=data.joints, t=ts, series=series)


def read_episode(rec: Recording) -> recordings_mcap.EpisodeData:
    """Action, state and subtask spans of one recording (for dataset conversion)."""
    return recordings_mcap.read_episode(disk.mcap_path(_sync(), rec))


def has_camera(rec: Recording, camera: str) -> bool:
    return any(t.kind == "video" and t.name == f"/cam_{camera}/image" for t in rec.topics)


def cameras(rec: Recording) -> list[str]:
    """Camera keys with recorded frames, in topic order."""
    return [
        t.name.removeprefix("/cam_").removesuffix("/image")
        for t in rec.topics
        if t.kind == "video" and t.messages and t.name.startswith("/cam_")
    ]


def read_frames(rec: Recording, camera: str) -> list[tuple[float, bytes]]:
    """JPEG frames of one camera (t in seconds from the episode start), for dataset conversion."""
    return recordings_mcap.read_frames(disk.mcap_path(_sync(), rec), camera)


def file_path(recording_id: str) -> Path:
    """MCAP of a recording (download)."""
    rec = require(recording_id)
    path = disk.mcap_path(_sync(), rec)
    if not path.is_file():
        raise not_found("Recording file", rec.file)
    return path


_video_lock = threading.Lock()


def video(recording_id: str, camera: str) -> Path:
    """MP4 of one camera, built from the MCAP frames on first use and kept next to it."""
    rec = require(recording_id)
    topic = next(
        (
            t
            for t in rec.topics
            if t.kind == "video" and t.name == recordings_mcap.camera_topic(camera)
        ),
        None,
    )
    if topic is None:
        raise not_found("Camera", camera)
    root = _sync()
    out = disk.video_path(root, rec, camera)
    # One build at a time (a player asks for several ranges at once)
    with _video_lock:
        if not out.is_file():
            try:
                frames = recordings_mcap.read_frames(disk.mcap_path(root, rec), camera)
            except recordings_mcap.McapReadError as e:
                raise ApiError(422, str(e)) from e
            fps = topic.rate_hz or len(frames) / max(rec.duration_s, 0.1)
            build_mp4(frames, rec.duration_s, fps, out)
    return out


reset()

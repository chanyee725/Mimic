"""Recording store: seed mocks (memory only) plus episodes on disk under the raw folder.

On-disk recordings (Capture saves, imports) are an MCAP plus a YAML sidecar each
(recordings_disk); they override seeds with the same id and survive restarts. The raw folder
follows Settings storage.raw_path and is rescanned whenever that setting changes.
"""

import math
import re
from pathlib import Path

from app.core.errors import ApiError, not_found
from app.core.events import bus
from app.schemas.common import Page, paginate
from app.seeds import load
from app.models.recordings import Recording, RecordingCheck, RecordingReview, RecordingSource
from app.schemas.recordings import Samples
from app.services import recordings_disk as disk
from app.services import recordings_mcap
from app.services.realtime import mock_robot
from app.services.rigs import get_rig
from app.utils.ids import slugify, split_csv
from app.utils.rng import unit_seed
from app.utils.time import iso, now_iso

_recordings: dict[str, Recording] = {}
_seeds: dict[str, Recording] = {}  # a seed shadowed by a disk recording returns on rescan
_on_disk: set[str] = set()  # ids backed by an MCAP + sidecar under _root
_root: Path | None = None  # raw folder last scanned

MCAP_MAGIC = b"\x89MCAP0\r\n"
SAMPLE_TOPICS = ("action", "state")
MAX_SAMPLES = 100_000  # per joint and topic
IMPORTS_DIR = "imports"  # <raw>/imports/<name>.mcap
_GENERIC_JOINTS = [f"joint_{i}" for i in range(1, 7)]


def reset() -> None:
    global _root
    _recordings.clear()
    _seeds.clear()
    _on_disk.clear()
    for r in load("recordings", "RECORDINGS"):
        r["recordedAt"] = iso(r["recordedAt"])
        _seeds[r["id"]] = Recording.model_validate(r)
    _recordings.update(_seeds)
    _root = None
    _sync()


def _sync() -> Path:
    """Reloads the disk recordings when the raw folder setting changed; returns the folder."""
    global _root
    root = disk.raw_dir()
    if root == _root:
        return root
    for rec_id in _on_disk:
        _recordings.pop(rec_id, None)
        if rec_id in _seeds:
            _recordings[rec_id] = _seeds[rec_id]
    _on_disk.clear()
    for rec in disk.load_all(root):
        if rec.id in _on_disk:
            continue  # two sidecars with one id: the first by path wins
        _recordings[rec.id] = rec
        _on_disk.add(rec.id)
    _root = root
    return root


def is_on_disk(recording_id: str) -> bool:
    _sync()
    return recording_id in _on_disk


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
) -> Page[Recording]:
    rows = [
        r
        for r in list_recordings(task_id)
        if (review is None or r.review == review) and (source is None or r.source == source)
    ]
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
    _on_disk.add(rec.id)
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
    if rec.id in _on_disk:
        try:
            disk.write_sidecar(_sync(), rec)
        except OSError as e:
            raise _write_failed(e) from e
    _recordings[rec.id] = rec
    bus.publish("recording.updated", rec)
    return rec


def delete(recording_id: str) -> None:
    """Removes the MCAP and sidecar of on-disk recordings; seed mocks are dropped from memory."""
    rec = require(recording_id)
    if recording_id in _on_disk:
        disk.remove(_sync(), rec)
        _on_disk.discard(recording_id)
    del _recordings[recording_id]
    bus.publish("recording.deleted", {"id": recording_id})


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
    """Joint data resampled at hz: read from the MCAP for on-disk recordings, else the mock."""
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
    if rec.id in _on_disk:
        return _file_samples(rec, topics, ts)
    rig = get_rig(rec.rig_id) if rec.rig_id else None
    joints = list(rig.joints) if rig else list(_GENERIC_JOINTS)
    seed = unit_seed(rec.id)  # each recording replays a different trajectory
    lag = {"action": 0.0, "state": mock_robot.STATE_LAG_S}
    series = {
        topic: [
            [round(mock_robot.sample(i, max(0.0, t - lag[topic]), seed), 3) for t in ts]
            for i in range(len(joints))
        ]
        for topic in topics
    }
    return Samples(joints=joints, t=ts, series=series)


def _file_samples(rec: Recording, topics: list[str], ts: list[float]) -> Samples:
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


def has_camera(rec: Recording, camera: str) -> bool:
    return any(t.kind == "video" and t.name == f"/cam_{camera}/image" for t in rec.topics)


def file_path(recording_id: str) -> Path:
    """MCAP of an on-disk recording (download); seed mocks have no file (501)."""
    rec = require(recording_id)
    if rec.id not in _on_disk:
        raise ApiError(501, "This recording is a mock without an MCAP file")
    path = disk.mcap_path(_sync(), rec)
    if not path.is_file():
        raise not_found("Recording file", rec.file)
    return path


def video(recording_id: str, camera: str) -> None:
    """One camera stream of a recording; extraction is not wired up yet."""
    if not has_camera(require(recording_id), camera):
        raise not_found("Camera", camera)
    raise ApiError(501, "Video extraction is not available yet")


reset()

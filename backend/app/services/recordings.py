"""Recording store (in memory, seeded from the web mocks)."""

import math
import re

from app.core.errors import ApiError, not_found
from app.core.events import bus
from app.schemas.common import Page, paginate
from app.seeds import load
from app.models.recordings import Recording, RecordingCheck, RecordingReview, RecordingSource
from app.schemas.recordings import Samples
from app.services.realtime import mock_robot
from app.services.rigs import get_rig
from app.utils.ids import slugify, split_csv
from app.utils.rng import unit_seed
from app.utils.time import iso, now_iso

_recordings: dict[str, Recording] = {}

MCAP_MAGIC = b"\x89MCAP0\r\n"
SAMPLE_TOPICS = ("action", "state")
MAX_SAMPLES = 100_000  # per joint and topic
_GENERIC_JOINTS = [f"joint_{i}" for i in range(1, 7)]


def reset() -> None:
    _recordings.clear()
    for r in load("recordings", "RECORDINGS"):
        r["recordedAt"] = iso(r["recordedAt"])
        _recordings[r["id"]] = Recording.model_validate(r)


def list_recordings(task_id: str | None = None) -> list[Recording]:
    rows = [r for r in _recordings.values() if task_id is None or r.task_id == task_id]
    return sorted(rows, key=lambda r: r.recorded_at, reverse=True)


def get_recording(recording_id: str) -> Recording | None:
    return _recordings.get(recording_id)


def require(recording_id: str) -> Recording:
    rec = _recordings.get(recording_id)
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


def add(rec: Recording) -> Recording:
    """Stores a new recording (Capture save, import) and announces it."""
    _recordings[rec.id] = rec
    bus.publish("recording.created", rec)
    return rec


def max_episode(task_id: str) -> int:
    return max((r.episode or 0 for r in _recordings.values() if r.task_id == task_id), default=0)


def set_review(recording_id: str, review: RecordingReview) -> Recording:
    rec = require(recording_id).model_copy(update={"review": review})
    _recordings[rec.id] = rec
    bus.publish("recording.updated", rec)
    return rec


def delete(recording_id: str) -> None:
    require(recording_id)
    del _recordings[recording_id]
    bus.publish("recording.deleted", {"id": recording_id})


def import_mcap(filename: str, data: bytes) -> Recording:
    """Registers an uploaded MCAP. Topics are filled in once the indexer exists."""
    if not filename.lower().endswith(".mcap"):
        raise ApiError(422, "Only .mcap files can be imported", {"filename": filename})
    if not data.startswith(MCAP_MAGIC):
        raise ApiError(422, "File is not a valid MCAP (bad magic bytes)", {"filename": filename})
    stem = slugify(filename[:-5]) or "file"
    rec_id, n = f"ext-{stem}", 1
    while rec_id in _recordings:
        n += 1
        rec_id = f"ext-{stem}-{n}"
    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", filename.rsplit("/", 1)[-1])
    rec = Recording(
        id=rec_id,
        file=f"imports/{safe_name}",
        source="external",
        recorded_at=now_iso(),
        duration_s=0,
        size_mb=round(len(data) / 1_000_000, 1),
        review="pending",
        topics=[],
        subtasks=[],
        drops=[],
        checks=[
            RecordingCheck(label="Metadata", value="missing task / rig", ok=False),
            RecordingCheck(label="Topics", value="not indexed yet", ok=False),
        ],
    )
    return add(rec)


def samples(
    recording_id: str, topics_csv: str, from_s: float, to_s: float | None, hz: float
) -> Samples:
    """Synthetic joint data until the MCAP reader exists (deterministic per recording)."""
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
    rig = get_rig(rec.rig_id) if rec.rig_id else None
    joints = list(rig.joints) if rig else list(_GENERIC_JOINTS)
    ts = [round(from_s + k / hz, 6) for k in range(n)]
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


def has_camera(rec: Recording, camera: str) -> bool:
    return any(t.kind == "video" and t.name == f"/cam_{camera}/image" for t in rec.topics)


def file(recording_id: str) -> None:
    """MCAP download; storage is not wired up yet."""
    require(recording_id)
    raise ApiError(501, "MCAP storage is not available yet")


def video(recording_id: str, camera: str) -> None:
    """One camera stream of a recording; extraction is not wired up yet."""
    if not has_camera(require(recording_id), camera):
        raise not_found("Camera", camera)
    raise ApiError(501, "Video extraction is not available yet")


reset()

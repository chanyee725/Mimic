"""Recording store (in memory, seeded from the web mocks)."""

from app.core.clock import iso
from app.core.seed import load
from app.recordings.schemas import Recording

_recordings: dict[str, Recording] = {}


def reset() -> None:
    _recordings.clear()
    for r in load("recordings", "RECORDINGS"):
        r["sizeMb"] = r.pop("sizeMB")
        r["recordedAt"] = iso(r["recordedAt"])
        _recordings[r["id"]] = Recording.model_validate(r)


def list_recordings(task_id: str | None = None) -> list[Recording]:
    rows = [r for r in _recordings.values() if task_id is None or r.task_id == task_id]
    return sorted(rows, key=lambda r: r.recorded_at, reverse=True)


def get_recording(recording_id: str) -> Recording | None:
    return _recordings.get(recording_id)


reset()

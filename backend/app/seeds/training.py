"""Training jobs from the web mocks (seeds/data/training.json)."""

import re

from app.models.training import TrainJob
from app.seeds import load
from app.utils.time import iso


def parse_duration(text: str | None) -> int | None:
    """ "2h 08m" / "58m" / "15h 49m" → seconds."""
    if not text:
        return None
    parts = dict((u, int(n)) for n, u in re.findall(r"(\d+)\s*([hms])", text))
    return parts.get("h", 0) * 3600 + parts.get("m", 0) * 60 + parts.get("s", 0)


def _job(j: dict) -> TrainJob:
    j["elapsedS"] = parse_duration(j.pop("elapsed", None))
    j["etaS"] = parse_duration(j.pop("eta", None))
    if j.get("startedAt"):
        j["startedAt"] = iso(j["startedAt"])
    if pod := j.get("podState"):
        pod["idleForS"] = parse_duration(pod.pop("idleFor", None))
        if pod.get("since"):
            pod["since"] = iso(pod["since"])
    for c in j["checkpoints"]:
        c["savedAt"] = iso(c["savedAt"])
    j["overrides"] = {}
    return TrainJob.model_validate(j)


def jobs() -> list[TrainJob]:
    """Seed jobs with ISO times and second durations (derived fields not filled)."""
    return [_job(j) for j in load("training", "JOBS")]

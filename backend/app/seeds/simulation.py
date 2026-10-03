"""Simulation jobs and GPU from the web mocks (app/core/seed/simulation.json)."""

import re
from typing import Any

from app.core.clock import iso
from app.seeds import load
from app.models.simulation import SimEpisode, SimGpu, SimJob

_UNITS = {"h": 3600, "m": 60, "s": 1}


def parse_duration(text: str | None) -> float | None:
    """Mock durations like "1h 5m", "21m" or "45s" → seconds."""
    if not text:
        return None
    parts = re.findall(r"(\d+(?:\.\d+)?)\s*([hms])", text)
    if not parts:
        raise ValueError(f"Unrecognised duration '{text}'")
    return sum(float(n) * _UNITS[u] for n, u in parts)


def counts(episodes: list[SimEpisode]) -> dict[str, Any]:
    """done / succeeded / failureReasons for a job's finished episodes."""
    reasons: dict[str, int] = {}
    for e in episodes:
        if not e.success:
            key = e.reason or "Unknown"
            reasons[key] = reasons.get(key, 0) + 1
    return dict(
        done=len(episodes),
        succeeded=sum(e.success for e in episodes),
        failure_reasons=reasons,
    )


def seed_jobs() -> tuple[list[SimJob], dict[str, list[SimEpisode]]]:
    jobs, episodes = [], {}
    for raw in load("simulation", "SIM_JOBS"):
        eps = [SimEpisode.model_validate(e) for e in raw.pop("results")]
        if raw.get("startedAt"):
            raw["startedAt"] = iso(raw["startedAt"])
        raw["elapsedS"] = parse_duration(raw.pop("elapsed", None))
        raw["etaS"] = parse_duration(raw.pop("eta", None))
        job = SimJob.model_validate(raw).model_copy(update=counts(eps))
        jobs.append(job)
        episodes[job.id] = eps
    return jobs, episodes


def seed_gpu() -> SimGpu:
    return SimGpu.model_validate(load("simulation", "SIM_GPU"))

"""Capture domain entities."""

from typing import Literal

from app.schemas.common import CamelModel

CapturePhase = Literal["idle", "countdown", "recording", "review"]


class CaptureState(CamelModel):
    phase: CapturePhase
    task_id: str | None = None
    episode_id: str | None = None
    started_at: str | None = None
    elapsed_s: float = 0
    subtask_index: int | None = None
    next_episode: int = 1

"""Task and session entities."""

from typing import Literal

from pydantic import Field

from app.schemas.common import CamelModel

TaskStatus = Literal["active", "draft", "completed"]
Outcome = Literal["success", "fail", "partial"]
# review: some episodes are still pending; reviewed: all accepted or rejected
SessionStatus = Literal["review", "reviewed"]

# Task ids are URL-safe slugs
SLUG = r"^[a-z0-9][a-z0-9-]{0,63}$"


class Subtask(CamelModel):
    key: str
    name: str
    description: str


class OutcomeKey(CamelModel):
    value: Outcome
    key: str


class TaskFields(CamelModel):
    """Editable task fields; id is optional here and required on create."""

    id: str | None = Field(None, pattern=SLUG)
    name: str = Field(min_length=1)
    instruction: str = Field(min_length=1)
    variants: list[str] = []
    tags: list[str] = []
    rig_id: str
    env_id: str | None = None  # Isaac Sim environment: set for an Isaac Sim task, None for real
    cameras: list[str] = Field(min_length=1)
    action_hz: int
    video_fps: int
    target_episodes: int = Field(ge=1)
    duration_s: float = Field(gt=0)
    reset_s: float = Field(ge=0)
    countdown_s: float = Field(ge=0)
    outcomes: list[OutcomeKey] = Field(min_length=1)
    subtasks: list[Subtask] = []
    success_criteria: str = ""
    repo_id: str = Field(min_length=1)
    push_to_hub: bool = False
    status: TaskStatus = "draft"


class Task(TaskFields):
    id: str = Field(pattern=SLUG)
    collected: int = 0  # computed from recordings, never stored
    version: int = 1
    updated_at: str


class Session(CamelModel):
    """Recordings of one task on one station day (derived, not stored)."""

    id: str
    task_id: str
    episodes: int
    accepted: int
    success_pct: float
    fail_pct: float
    status: SessionStatus
    date: str

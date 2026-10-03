from typing import Literal

from pydantic import Field

from app.schemas.common import CamelModel

TaskStatus = Literal["active", "draft", "completed"]
Outcome = Literal["success", "fail", "partial"]
SessionStatus = Literal["recording", "review", "converted"]

# Task ids are URL-safe slugs
SLUG = r"^[a-z0-9][a-z0-9-]{0,63}$"
OPERATOR_ID = r"^OP-\d{2}$"


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


class TaskInput(TaskFields):
    id: str = Field(pattern=SLUG)


class TaskUpdate(TaskFields):
    # id is immutable; if sent it must match the path
    version: int


class TaskDuplicate(CamelModel):
    id: str = Field(pattern=SLUG)
    name: str = Field(min_length=1)


class Task(TaskInput):
    collected: int = 0
    version: int = 1
    updated_at: str
    updated_by: str


class Session(CamelModel):
    id: str
    task_id: str
    operator: str
    episodes: int
    accepted: int
    success_pct: float
    fail_pct: float
    status: SessionStatus
    date: str

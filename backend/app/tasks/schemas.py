from typing import Literal

from app.core.schemas import CamelModel

TaskStatus = Literal["active", "draft", "completed"]
Outcome = Literal["success", "fail", "partial"]


class Subtask(CamelModel):
    key: str
    name: str
    description: str


class OutcomeKey(CamelModel):
    value: Outcome
    key: str


class TaskInput(CamelModel):
    id: str
    name: str
    instruction: str
    variants: list[str] = []
    tags: list[str] = []
    rig_id: str
    cameras: list[str]
    action_hz: int
    video_fps: int
    target_episodes: int
    duration_s: float
    reset_s: float
    countdown_s: float
    outcomes: list[OutcomeKey]
    subtasks: list[Subtask] = []
    success_criteria: str = ""
    repo_id: str
    push_to_hub: bool = False
    status: TaskStatus = "draft"


class Task(TaskInput):
    collected: int = 0
    version: int = 1
    updated_at: str
    updated_by: str

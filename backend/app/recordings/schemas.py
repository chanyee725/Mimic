from typing import Literal

from pydantic import Field

from app.core.schemas import CamelModel
from app.tasks.schemas import Outcome

TopicKind = Literal["action", "state", "video", "label", "glove", "other"]
RecordingReview = Literal["pending", "accepted", "rejected"]


class McapTopic(CamelModel):
    name: str
    schema_: str = Field(alias="schema")
    kind: TopicKind
    rate_hz: float | None
    messages: int


class RecordingCheck(CamelModel):
    label: str
    value: str
    ok: bool


class SubtaskSpan(CamelModel):
    name: str
    start_s: float
    end_s: float


class Recording(CamelModel):
    id: str
    file: str
    source: Literal["capture", "external"]
    task_id: str | None = None
    rig_id: str | None = None
    episode: int | None = None
    recorded_at: str
    duration_s: float
    size_mb: float
    outcome: Outcome | None = None
    review: RecordingReview
    topics: list[McapTopic]
    subtasks: list[SubtaskSpan]
    drops: list[float]
    checks: list[RecordingCheck]

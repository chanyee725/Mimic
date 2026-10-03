from typing import Literal

from pydantic import Field

from app.core.schemas import CamelModel
from app.tasks.schemas import Outcome

TopicKind = Literal["action", "state", "video", "label", "glove", "other"]
RecordingReview = Literal["pending", "accepted", "rejected"]
RecordingSource = Literal["capture", "external"]


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
    source: RecordingSource
    task_id: str | None = None
    rig_id: str | None = None
    episode: int | None = None
    recorded_at: str
    duration_s: float
    size_mb: float = Field(alias="sizeMB")
    outcome: Outcome | None = None
    review: RecordingReview
    topics: list[McapTopic]
    subtasks: list[SubtaskSpan]
    drops: list[float]
    checks: list[RecordingCheck]


class ReviewPatch(CamelModel):
    review: RecordingReview


class Samples(CamelModel):
    """Resampled joint series for plots: series[topic][joint][sample]."""

    joints: list[str]
    t: list[float]
    series: dict[str, list[list[float]]]

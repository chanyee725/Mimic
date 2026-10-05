from pydantic import Field

from app.models.recordings import Recording, RecordingReview
from app.schemas.common import CamelModel


class ReviewPatch(CamelModel):
    review: RecordingReview


class BulkIds(CamelModel):
    ids: list[str] = Field(min_length=1, max_length=100_000)


class BulkReview(BulkIds):
    review: RecordingReview


class BulkReviewResult(CamelModel):
    items: list[Recording]


class Samples(CamelModel):
    """Resampled joint series for plots: series[topic][joint][sample]."""

    joints: list[str]
    t: list[float]
    series: dict[str, list[list[float]]]

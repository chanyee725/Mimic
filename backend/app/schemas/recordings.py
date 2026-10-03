from app.models.recordings import RecordingReview
from app.schemas.common import CamelModel


class ReviewPatch(CamelModel):
    review: RecordingReview


class Samples(CamelModel):
    """Resampled joint series for plots: series[topic][joint][sample]."""

    joints: list[str]
    t: list[float]
    series: dict[str, list[list[float]]]

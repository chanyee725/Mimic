from typing import Literal

from pydantic import Field, model_validator

from app.models.realtime import StreamSource, WebRtcTrack
from app.schemas.common import CamelModel


class WebRtcOffer(CamelModel):
    sdp: str = Field(min_length=1)
    type: Literal["offer"]
    source: StreamSource
    rig_id: str | None = None
    sim_job_id: str | None = None
    cameras: list[str] = Field(min_length=1)

    @model_validator(mode="after")
    def _source_id(self) -> "WebRtcOffer":
        if self.source == "rig" and not self.rig_id:
            raise ValueError("rigId is required when source is 'rig'")
        if self.source == "sim" and not self.sim_job_id:
            raise ValueError("simJobId is required when source is 'sim'")
        return self


class WebRtcAnswer(CamelModel):
    session_id: str
    sdp: str
    type: Literal["answer"] = "answer"
    tracks: list[WebRtcTrack]

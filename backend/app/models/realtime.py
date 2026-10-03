"""Realtime entities: WebRTC stream sources and the tracks of a session."""

from typing import Literal

from app.schemas.common import CamelModel

StreamSource = Literal["rig", "sim"]


class WebRtcTrack(CamelModel):
    camera: str
    mid: str

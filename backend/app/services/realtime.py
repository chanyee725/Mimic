"""WebRTC signalling state. No camera pipeline yet: offers are validated, then refused."""

from app.core.errors import ApiError, not_found
from app.schemas.realtime import WebRtcAnswer, WebRtcOffer
from app.services.rigs import get_rig

# Session id → answer sent for it (stays empty until the camera pipeline exists)
_sessions: dict[str, WebRtcAnswer] = {}


def reset() -> None:
    _sessions.clear()


def create_session(offer: WebRtcOffer) -> WebRtcAnswer:
    if offer.source == "rig" and get_rig(offer.rig_id or "") is None:
        raise not_found("Rig", offer.rig_id or "")
    raise ApiError(
        501,
        "WebRTC video is not available yet: the camera pipeline is not implemented",
        {"source": offer.source},
    )


def close_session(session_id: str) -> None:
    if _sessions.pop(session_id, None) is None:
        raise not_found("WebRTC session", session_id)

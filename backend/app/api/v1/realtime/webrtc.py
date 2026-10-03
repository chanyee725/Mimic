"""WebRTC signalling for camera streams."""

from fastapi import APIRouter, Response

from app.schemas.realtime import WebRtcAnswer, WebRtcOffer
from app.services import realtime as service

router = APIRouter()


@router.post(
    "/webrtc/offer",
    response_model=WebRtcAnswer,
    responses={501: {"description": "Camera pipeline not implemented yet"}},
)
def webrtc_offer(body: WebRtcOffer) -> WebRtcAnswer:
    return service.create_session(body)


@router.delete("/webrtc/sessions/{session_id}", status_code=204)
def webrtc_close(session_id: str) -> Response:
    service.close_session(session_id)
    return Response(status_code=204)

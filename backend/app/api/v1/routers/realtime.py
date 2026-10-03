"""Realtime endpoints — see docs/api/realtime.md."""

import asyncio

from fastapi import APIRouter, Response, WebSocket, WebSocketDisconnect

from app.schemas.realtime import WebRtcAnswer, WebRtcOffer
from app.services import realtime as service

router = APIRouter(prefix="", tags=["realtime"])


@router.websocket("/ws/events")
async def events(ws: WebSocket, topics: str | None = None) -> None:
    wanted, hello = service.open_events(topics)
    await ws.accept()
    # Subscribe before "hello" so nothing published after it is missed
    q = service.subscribe()
    forward: asyncio.Task[None] | None = None
    try:
        await ws.send_json(hello)
        forward = asyncio.create_task(service.forward(q, wanted, ws.send_json))
        while True:
            reply = service.reply_to(await ws.receive_text())
            if reply is not None:
                await ws.send_json(reply)
    except WebSocketDisconnect:
        pass
    finally:
        if forward:
            forward.cancel()
        service.unsubscribe(q)


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

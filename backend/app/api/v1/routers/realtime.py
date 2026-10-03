"""Realtime endpoints — see docs/api/realtime.md."""

import asyncio
import json
from typing import Any

from fastapi import APIRouter, Response, WebSocket, WebSocketDisconnect

from app.core.events import bus
from app.services import realtime as service
from app.schemas.realtime import WebRtcAnswer, WebRtcOffer
from app.services.realtime_topics import parse_topics, topic_of

router = APIRouter(prefix="", tags=["realtime"])


async def _forward(ws: WebSocket, q: asyncio.Queue[dict[str, Any]], topics: set[str]) -> None:
    while True:
        msg = await q.get()
        if topic_of(msg["type"]) in topics:
            await ws.send_json(msg)


@router.websocket("/ws/events")
async def events(ws: WebSocket, topics: str | None = None) -> None:
    accepted, unknown = parse_topics(topics)
    await ws.accept()
    # Subscribe before "hello" so nothing published after it is missed
    q = bus.subscribe()
    forward: asyncio.Task[None] | None = None
    try:
        hello: dict[str, Any] = {"type": "hello", "topics": accepted}
        if unknown:
            hello["ignored"] = unknown
        await ws.send_json(hello)
        forward = asyncio.create_task(_forward(ws, q, set(accepted)))
        while True:
            text = await ws.receive_text()
            try:
                msg = json.loads(text)
            except ValueError:
                continue
            if isinstance(msg, dict) and msg.get("type") == "ping":
                await ws.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    finally:
        if forward:
            forward.cancel()
        bus.unsubscribe(q)


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

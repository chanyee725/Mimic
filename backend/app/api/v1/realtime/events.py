"""Event stream over WebSocket."""

import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services import realtime as service

router = APIRouter()


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

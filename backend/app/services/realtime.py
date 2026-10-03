"""Realtime state: /ws/events subscriptions and WebRTC signalling.

No camera pipeline yet: WebRTC offers are validated, then refused.
"""

import asyncio
import json
from collections.abc import Awaitable, Callable
from typing import Any

from app.core.errors import ApiError, not_found
from app.core.events import Message, bus
from app.schemas.realtime import WebRtcAnswer, WebRtcOffer
from app.services.realtime_topics import parse_topics, topic_of
from app.services.rigs import get_rig

# Session id → answer sent for it (stays empty until the camera pipeline exists)
_sessions: dict[str, WebRtcAnswer] = {}


def reset() -> None:
    _sessions.clear()


# Event socket


def open_events(raw_topics: str | None) -> tuple[set[str], Message]:
    """`?topics=` → (topics to forward, hello message)."""
    accepted, unknown = parse_topics(raw_topics)
    hello: dict[str, Any] = {"type": "hello", "topics": accepted}
    if unknown:
        hello["ignored"] = unknown
    return set(accepted), hello


def subscribe() -> asyncio.Queue[Message]:
    return bus.subscribe()


def unsubscribe(q: asyncio.Queue[Message]) -> None:
    bus.unsubscribe(q)


async def forward(
    q: asyncio.Queue[Message], topics: set[str], send: Callable[[Message], Awaitable[None]]
) -> None:
    """Sends every bus message whose topic was requested, until cancelled."""
    while True:
        msg = await q.get()
        if topic_of(msg["type"]) in topics:
            await send(msg)


def reply_to(text: str) -> Message | None:
    """Answer to a client frame: pong for a ping, nothing for anything else."""
    try:
        msg = json.loads(text)
    except ValueError:
        return None
    if isinstance(msg, dict) and msg.get("type") == "ping":
        return {"type": "pong"}
    return None


# WebRTC


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

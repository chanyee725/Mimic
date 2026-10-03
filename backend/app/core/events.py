"""In-process event bus feeding the /ws/events socket."""

import asyncio
from typing import Any

from app.core.clock import now_iso


class EventBus:
    def __init__(self) -> None:
        self._subs: set[asyncio.Queue[dict[str, Any]]] = set()

    def subscribe(self) -> asyncio.Queue[dict[str, Any]]:
        q: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=1000)
        self._subs.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue[dict[str, Any]]) -> None:
        self._subs.discard(q)

    def publish(self, type_: str, data: Any) -> None:
        """type_ like "training.updated"; data is a schema model or plain JSON."""
        payload = (
            data.model_dump(by_alias=True, mode="json") if hasattr(data, "model_dump") else data
        )
        msg = {"type": type_, "at": now_iso(), "data": payload}
        for q in list(self._subs):
            if not q.full():
                q.put_nowait(msg)


bus = EventBus()

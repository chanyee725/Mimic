"""In-process event bus feeding the /ws/events socket."""

import asyncio
from typing import Any

from app.utils.time import now_iso

Message = dict[str, Any]


def _deliver(q: asyncio.Queue[Message], msg: Message) -> None:
    # Slow consumers drop messages instead of blocking publishers
    if not q.full():
        q.put_nowait(msg)


class EventBus:
    def __init__(self) -> None:
        # Queue → the event loop that awaits it (None when subscribed outside a loop)
        self._subs: dict[asyncio.Queue[Message], asyncio.AbstractEventLoop | None] = {}

    def subscribe(self) -> asyncio.Queue[Message]:
        q: asyncio.Queue[Message] = asyncio.Queue(maxsize=1000)
        try:
            loop: asyncio.AbstractEventLoop | None = asyncio.get_running_loop()
        except RuntimeError:
            loop = None
        self._subs[q] = loop
        return q

    def unsubscribe(self, q: asyncio.Queue[Message]) -> None:
        self._subs.pop(q, None)

    @property
    def subscriber_count(self) -> int:
        return len(self._subs)

    def publish(self, type_: str, data: Any) -> None:
        """type_ like "training.updated"; data is a schema model or plain JSON.

        Safe to call from any thread (background jobs, test clients): delivery is
        scheduled on the subscriber's own event loop.
        """
        payload = (
            data.model_dump(by_alias=True, mode="json") if hasattr(data, "model_dump") else data
        )
        msg = {"type": type_, "at": now_iso(), "data": payload}
        try:
            current: asyncio.AbstractEventLoop | None = asyncio.get_running_loop()
        except RuntimeError:
            current = None
        for q, loop in list(self._subs.items()):
            if loop is None or loop is current:
                _deliver(q, msg)
                continue
            try:
                loop.call_soon_threadsafe(_deliver, q, msg)
            except RuntimeError:
                # Loop already closed: the subscriber is gone
                self.unsubscribe(q)


bus = EventBus()

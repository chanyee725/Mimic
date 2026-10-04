"""Live camera previews, at most one per camera.

A browser may keep an MJPEG request open after its <img> is gone (and a dev proxy may keep the
upstream side open), so a preview cannot rely on the client hanging up. Opening the camera again —
another preview or a connection test — closes the preview holding it.
"""

import os
import threading
from collections.abc import Iterator

from app.services.rigs import driver

_lock = threading.Lock()
_open: dict[str, "Preview"] = {}  # camera node (/dev/videoN) → its preview


def node(port: str) -> str:
    """Kernel node behind a by-id / by-path link."""
    return os.path.realpath(port)


class Preview:
    """JPEG frames of one camera; close() is safe from any thread and waits for a read in flight."""

    def __init__(self, key: str, frames: Iterator[bytes]):
        self.key, self._frames, self._lock, self.closed = key, frames, threading.Lock(), False

    def next(self) -> bytes | None:
        with self._lock:
            return None if self.closed else next(self._frames, None)

    def close(self) -> None:
        with self._lock:
            if self.closed:
                return
            self.closed = True
            self._frames.close()
        with _lock:
            if _open.get(self.key) is self:
                del _open[self.key]


def open_preview(port: str) -> Preview:
    key = node(port)
    release(port)
    preview = Preview(key, driver.get().camera_frames(port))
    with _lock:
        _open[key] = preview
    return preview


def release(port: str) -> None:
    """Close the preview holding this camera, if any (returns once the camera is free)."""
    with _lock:
        preview = _open.get(node(port))
    if preview is not None:
        preview.close()


def reset() -> None:
    with _lock:
        previews = list(_open.values())
    for p in previews:
        p.close()

"""Camera hub: one reader per camera, shared by live previews and capture recorders.

A reader thread pulls JPEG frames from the driver and fans them out: a preview waits for the
latest frame, a recorder keeps every frame with its wall time. The reader stops when its last
subscriber leaves.

A browser may keep an MJPEG request open after its <img> is gone (and a dev proxy may keep the
upstream side open), so a preview cannot rely on the client hanging up: a camera has at most one
preview, and opening another one closes it. A connection test needs the camera to itself: it
closes the camera's previews and reader, and is refused while a recorder holds the camera.
"""

import logging
import os
import threading
import time
from collections.abc import Iterator

from app.core.errors import conflict
from app.services.rigs import driver

log = logging.getLogger(__name__)

# How long close() waits for a reader blocked in a frame read
JOIN_S = 2.0

_lock = threading.Lock()
_open_lock = threading.Lock()
_readers: dict[str, "Reader"] = {}  # camera node (/dev/videoN) → its reader


def node(port: str) -> str:
    """Kernel node behind a by-id / by-path link."""
    return os.path.realpath(port)


class Reader:
    """Pulls frames of one camera in a thread; subscribers come and go."""

    def __init__(self, key: str, frames: Iterator[bytes]):
        self.key, self._frames = key, frames
        self._cond = threading.Condition()
        self.seq = 0
        self.latest: tuple[float, bytes] | None = None
        self.closed = False
        self.previews: list[Preview] = []
        self.recorders: list[Recorder] = []
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, name=f"camera {key}", daemon=True)
        self._thread.start()

    def _run(self) -> None:
        try:
            for jpeg in self._frames:
                if self._stop.is_set():
                    break
                wall = time.time()
                with self._cond:
                    self.seq += 1
                    self.latest = (wall, jpeg)
                    for r in self.recorders:
                        r.add(wall, jpeg)
                    self._cond.notify_all()
        except Exception:
            log.exception("Camera %s failed", self.key)
        finally:
            # The frame source releases the device when closed (from this thread only)
            try:
                self._frames.close()
            except Exception:
                log.exception("Closing camera %s failed", self.key)
            with self._cond:
                self.closed = True
                self._cond.notify_all()
            with _lock:
                if _readers.get(self.key) is self:
                    del _readers[self.key]

    def wait_frame(self, after: int, timeout: float) -> tuple[int, bytes] | None:
        """The first frame newer than `after`, or None when the reader ends or the wait times out."""
        with self._cond:
            if not self._cond.wait_for(lambda: self.closed or self.seq > after, timeout):
                return None
            if self.seq <= after or self.latest is None:
                return None
            return self.seq, self.latest[1]

    def leave(self, sub: "Preview | Recorder") -> None:
        """Drop a subscriber; the reader stops with its last one."""
        with self._cond:
            if sub in self.previews:
                self.previews.remove(sub)
            if sub in self.recorders:
                self.recorders.remove(sub)
            last = not self.previews and not self.recorders
            self._cond.notify_all()
        if last:
            self.close()

    def close(self) -> None:
        """Stop reading and wait (up to JOIN_S) until the camera is released."""
        self._stop.set()
        with self._cond:
            self._cond.notify_all()
        if self._thread is not threading.current_thread():
            self._thread.join(timeout=JOIN_S)


class Preview:
    """Latest frames of one camera for a live view; close() is safe from any thread."""

    def __init__(self, reader: Reader):
        self.reader, self.closed, self._seen = reader, False, 0

    def next(self, timeout: float = 2.0) -> bytes | None:
        """The next new frame; None once closed, the reader ended or no frame came in time."""
        if self.closed:
            return None
        got = self.reader.wait_frame(self._seen, timeout)
        if got is None or self.closed:
            return None
        self._seen, jpeg = got
        return jpeg

    def close(self) -> None:
        if self.closed:
            return
        self.closed = True
        self.reader.leave(self)


class Recorder:
    """Every frame of one camera with its wall time, until released."""

    def __init__(self, reader: Reader, max_frames: int):
        self.reader, self.max_frames = reader, max_frames
        self.frames: list[tuple[float, bytes]] = []
        self.closed = False

    def add(self, wall: float, jpeg: bytes) -> None:
        # Called by the reader thread under its lock
        self.frames.append((wall, jpeg))
        if len(self.frames) > self.max_frames:
            del self.frames[: len(self.frames) - self.max_frames]

    def between(self, start: float, end: float) -> list[tuple[float, bytes]]:
        """Frames whose wall time is in [start, end], with t counted from `start`."""
        with self.reader._cond:
            return [(w - start, j) for w, j in self.frames if start <= w <= end]

    def close(self) -> None:
        if self.closed:
            return
        self.closed = True
        self.reader.leave(self)


def _reader(port: str, width: int, height: int, fps: int) -> Reader:
    """The camera's reader, opened at these settings when there is none (first opener wins)."""
    key = node(port)
    # One opener at a time: two readers on one camera would fight over the device
    with _open_lock:
        with _lock:
            reader = _readers.get(key)
        if reader is not None:
            if not reader.closed and not reader._stop.is_set():
                return reader
            reader.close()  # still shutting down: wait until the device is free
        frames = driver.get().camera_frames(port, width, height, fps)
        reader = Reader(key, frames)
        with _lock:
            _readers[key] = reader
        return reader


def open_preview(port: str, width: int = 640, height: int = 480, fps: int = 30) -> Preview:
    """A live view of the camera; replaces the camera's previous preview."""
    reader = _reader(port, width, height, fps)
    preview = Preview(reader)
    with reader._cond:
        old = list(reader.previews)
        reader.previews.append(preview)
    for p in old:
        p.close()
    return preview


def open_recorder(
    port: str, width: int, height: int, fps: int, max_frames: int = 30 * 600
) -> Recorder:
    reader = _reader(port, width, height, fps)
    recorder = Recorder(reader, max_frames)
    with reader._cond:
        reader.recorders.append(recorder)
    return recorder


def recording(port: str) -> bool:
    with _lock:
        reader = _readers.get(node(port))
    return reader is not None and bool(reader.recorders)


def release(port: str) -> None:
    """Free the camera for exclusive use (a connection test): closes its previews and reader.
    409 while a recorder holds it."""
    with _lock:
        reader = _readers.get(node(port))
    if reader is None:
        return
    if reader.recorders:
        raise conflict(f"Camera {port} is recording")
    with reader._cond:
        previews = list(reader.previews)
    for p in previews:
        p.closed = True
    with reader._cond:
        reader.previews.clear()
    reader.close()


def reset() -> None:
    with _lock:
        readers = list(_readers.values())
    for r in readers:
        with r._cond:
            for sub in [*r.previews, *r.recorders]:
                sub.closed = True
            r.previews.clear()
            r.recorders.clear()
        r.close()

"""H.264 MP4 writing and JPEG frame timing (PyAV); used for playback videos and dataset videos."""

from collections.abc import Iterable, Iterator
from fractions import Fraction
from pathlib import Path
from typing import Any


def even(n: int) -> int:
    """yuv420p needs even dimensions."""
    return n - n % 2


class JpegDecoder:
    def __init__(self) -> None:
        import av

        self._av = av
        self._ctx = av.CodecContext.create("mjpeg", "r")

    def decode(self, jpeg: bytes) -> Any:
        return self._ctx.decode(self._av.Packet(jpeg))[0]


def held(frames: list[tuple[float, bytes]], times: Iterable[float]) -> Iterator[Any]:
    """For each time, the last camera frame at or before it (the first frame before the first
    timestamp); a JPEG is decoded only when the shown frame changes."""
    decoder = JpegDecoder()
    idx, shown, picture = 0, -1, None
    for t in times:
        while idx + 1 < len(frames) and frames[idx + 1][0] <= t + 1e-9:
            idx += 1
        if idx != shown:
            picture = decoder.decode(frames[idx][1])
            shown = idx
        yield picture


class H264Writer:
    """Constant-rate H.264 (libx264, yuv420p) MP4; frame k is shown at k / fps."""

    def __init__(self, path: Path, width: int, height: int, fps: int, faststart: bool = True):
        import av

        self.path, self.width, self.height, self.fps = path, even(width), even(height), fps
        self.frames = 0
        options = {"movflags": "+faststart"} if faststart else {}
        self._container = av.open(str(path), "w", format="mp4", options=options)
        self._stream = self._container.add_stream("libx264", rate=Fraction(fps, 1))
        self._stream.width, self._stream.height = self.width, self.height
        self._stream.pix_fmt = "yuv420p"
        self._stream.options = {"crf": "23", "preset": "veryfast"}

    def write(self, frame: Any) -> None:
        out = frame.reformat(width=self.width, height=self.height, format="yuv420p")
        out.pts = self.frames
        out.time_base = Fraction(1, self.fps)
        for packet in self._stream.encode(out):
            self._container.mux(packet)
        self.frames += 1

    def size(self) -> int:
        """Bytes written so far (the encoder may still hold a few frames)."""
        return self.path.stat().st_size if self.path.exists() else 0

    def close(self) -> None:
        if self._container is None:
            return
        for packet in self._stream.encode():
            self._container.mux(packet)
        self._container.close()
        self._container = None


def first_frame_at(path: Path, t: float) -> Any:
    """The first decoded frame at or after time t (seconds) of a video file."""
    import av

    with av.open(str(path)) as container:
        stream = container.streams.video[0]
        if t > 0:
            container.seek(int(t / stream.time_base), stream=stream, backward=True)
        for frame in container.decode(stream):
            if frame.time is None or frame.time >= t - 1e-4:
                return frame
    raise ValueError(f"{path} has no frame at {t:.3f} s")

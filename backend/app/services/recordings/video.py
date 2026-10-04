"""Browser-playable MP4 (H.264) of one camera of an episode, built from its MCAP JPEG frames."""

import os
import tempfile
from fractions import Fraction
from pathlib import Path


def build_mp4(frames: list[tuple[float, bytes]], duration_s: float, fps: float, out: Path) -> None:
    """Constant-rate video of `duration_s` at round(fps): each output frame shows the last camera
    frame at or before its time (frames are held or skipped to stay in sync). Written atomically."""
    import av

    rate = max(1, round(fps))
    total = max(1, round(duration_s * rate))
    decoder = av.CodecContext.create("mjpeg", "r")

    def decode(jpeg: bytes) -> "av.VideoFrame":
        return decoder.decode(av.Packet(jpeg))[0]

    first = decode(frames[0][1])
    # yuv420p needs even dimensions
    width, height = first.width - first.width % 2, first.height - first.height % 2

    fd, tmp = tempfile.mkstemp(dir=out.parent, prefix=f".{out.name}.", suffix=".mp4")
    os.close(fd)
    try:
        with av.open(tmp, "w", format="mp4", options={"movflags": "+faststart"}) as container:
            stream = container.add_stream("libx264", rate=Fraction(rate, 1))
            stream.width, stream.height, stream.pix_fmt = width, height, "yuv420p"
            stream.options = {"crf": "23", "preset": "veryfast"}
            idx, shown, picture = 0, -1, first
            for k in range(total):
                t = k / rate
                while idx + 1 < len(frames) and frames[idx + 1][0] <= t:
                    idx += 1
                if idx != shown:
                    picture = first if idx == 0 else decode(frames[idx][1])
                    shown = idx
                frame = picture.reformat(width=width, height=height, format="yuv420p")
                frame.pts = k
                frame.time_base = Fraction(1, rate)
                for packet in stream.encode(frame):
                    container.mux(packet)
            for packet in stream.encode():
                container.mux(packet)
        os.replace(tmp, out)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise

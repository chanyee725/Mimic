"""Browser-playable MP4 (H.264) of one camera of an episode, built from its MCAP JPEG frames."""

import os
import tempfile
from pathlib import Path

from app.utils.video import H264Writer, JpegDecoder, held


def build_mp4(frames: list[tuple[float, bytes]], duration_s: float, fps: float, out: Path) -> None:
    """Constant-rate video of `duration_s` at round(fps): each output frame shows the last camera
    frame at or before its time (frames are held or skipped to stay in sync). Written atomically."""
    rate = max(1, round(fps))
    total = max(1, round(duration_s * rate))
    first = JpegDecoder().decode(frames[0][1])

    fd, tmp = tempfile.mkstemp(dir=out.parent, prefix=f".{out.name}.", suffix=".mp4")
    os.close(fd)
    try:
        writer = H264Writer(Path(tmp), first.width, first.height, rate)
        try:
            for picture in held(frames, (k / rate for k in range(total))):
                writer.write(picture)
        finally:
            writer.close()
        os.replace(tmp, out)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise

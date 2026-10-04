"""Capture records the task's cameras into the episode MCAP; Review plays them back as MP4."""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from app.configs.config import config
from app.services import capture, recordings
from app.services import rigs as rigs_service
from app.services.capture import session
from app.services.recordings import mcap_io
from app.services.rigs import driver, ports
from app.utils import time
from tests.conftest import add_tasks, connect_devices
from tests.support import FakeDriver, jpeg

T0 = datetime(2026, 10, 3, 10, 0, 0, tzinfo=ZoneInfo("Asia/Seoul"))
START = {"taskId": "stack-two-blocks", "operator": "OP-01"}


@pytest.fixture(autouse=True)
def fake(tmp_path, monkeypatch):
    d = FakeDriver(tmp_path / "calibration")
    d.calibration_dir.mkdir()
    d.frame_count = 0  # the test fills the recorders
    monkeypatch.setattr(ports, "exists", lambda p: True)
    driver.use(d)
    rigs_service.reset()
    add_tasks("stack-two-blocks")
    connect_devices()
    capture.reset()
    recordings.reset()
    time.set_clock(lambda: T0)
    yield d
    time.set_clock(None)
    driver.use(None)
    capture.reset()
    rigs_service.reset()


def _record(client, frames: dict[str, list[float]], duration: float = 1.0) -> dict:
    """Start, put frames at these seconds (from the recording start) into each camera, save."""
    assert client.post("/capture/start", json=START).status_code == 200
    s = session._session
    assert set(s.cameras) == set(frames)
    start = s.recording_at.timestamp()
    for key, ts in frames.items():
        # Shades differ per frame so the video has content
        s.cameras[key].frames[:] = [
            (start + t, jpeg(shade=(i * 7) % 255)) for i, t in enumerate(ts)
        ]
    time.set_clock(lambda: s.recording_at + timedelta(seconds=duration))
    r = client.post("/capture/save", json={"outcome": "success"})
    assert r.status_code == 201, r.text
    return r.json()


def _steady(n: int = 30, fps: float = 30) -> list[float]:
    return [k / fps for k in range(n)]


def test_cameras_are_recorded_into_the_mcap(client, fake):
    # One frame before the start and one after the end are cut off
    rec = _record(client, {"top": [-0.2, *_steady()], "wrist": [*_steady(), 1.5]})
    topics = {t["name"]: t for t in rec["topics"]}
    top = topics["/cam_top/image"]
    assert top["kind"] == "video" and top["schema"] == "foxglove.CompressedImage"
    assert top["messages"] == 30 and top["rateHz"] == 30.0
    checks = {c["label"]: c for c in rec["checks"]}
    assert checks["Video top"] == {"label": "Video top", "value": "30 / 30", "ok": True}
    assert rec["drops"] == []

    path = config.recordings_dir / rec["file"]
    frames = mcap_io.read_frames(path, "top")
    assert len(frames) == 30 and frames[0][1][:2] == b"\xff\xd8"  # JPEG as recorded
    # Cameras are released after the save
    assert session._session is None


def test_drops_and_short_video_fail_the_check(client, fake):
    # 15 frames with a 0.3 s hole after 0.2 s
    ts = [k / 30 for k in range(7)] + [0.5 + k / 30 for k in range(8)]
    rec = _record(client, {"top": ts, "wrist": _steady()})
    checks = {c["label"]: c for c in rec["checks"]}
    assert checks["Video top"]["value"] == "15 / 30" and checks["Video top"]["ok"] is False
    assert rec["drops"] == [0.2]


def test_video_endpoint_serves_an_mp4(client, fake):
    rec = _record(client, {"top": _steady(), "wrist": _steady()})
    url = f"/recordings/{rec['id']}/video/top"
    r = client.get(url)
    assert r.status_code == 200 and r.headers["content-type"] == "video/mp4"
    assert r.content[4:8] == b"ftyp"
    cached = (config.recordings_dir / rec["file"]).with_name("ep_0001.top.mp4")
    assert cached.is_file()
    # Range requests (video seeking)
    part = client.get(url, headers={"Range": "bytes=0-99"})
    assert part.status_code == 206 and len(part.content) == 100
    # The MP4 holds the full duration at the camera rate
    import av

    with av.open(str(cached)) as c:
        v = c.streams.video[0]
        assert v.codec_context.name == "h264" and v.frames == 30
    # Deleting the recording removes its cached videos
    assert client.delete(f"/recordings/{rec['id']}").status_code == 204
    assert not cached.exists()


def test_video_endpoint_404s(client, fake):
    rec = _record(client, {"top": _steady(), "wrist": _steady()})
    assert client.get(f"/recordings/{rec['id']}/video/side").status_code == 404
    assert client.get("/recordings/missing/video/top").status_code == 404


def test_recorder_keeps_the_camera_until_the_episode_ends(client, fake):
    fake.frame_count = None
    assert client.post("/capture/start", json=START).status_code == 200
    # A connection test of a recording camera is refused
    assert client.post("/devices/top/test").status_code == 409
    assert client.post("/capture/discard").status_code == 200
    assert client.post("/devices/top/test").status_code == 200

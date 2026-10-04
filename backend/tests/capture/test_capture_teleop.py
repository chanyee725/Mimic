"""Capture with device access (fake LeRobot driver): teleop runs and episodes hold its samples."""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from app.configs.config import config
from app.services import capture, recordings
from app.services import rigs as rigs_service
from app.services.recordings import mcap_io
from app.services.rigs import driver, ports, teleop
from app.services.rigs.teleop import _Sample
from app.utils import time
from tests.conftest import add_tasks, connect_devices
from tests.support import FakeDriver

T0 = datetime(2026, 10, 3, 10, 0, 0, tzinfo=ZoneInfo("Asia/Seoul"))
START = {"taskId": "stack-two-blocks", "operator": "OP-01"}


@pytest.fixture(autouse=True)
def fake(tmp_path, monkeypatch):
    d = FakeDriver(tmp_path / "calibration")
    d.calibration_dir.mkdir()
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
    rigs_service.reset()
    capture.reset()


def _paused():
    """Stop the loop (session stays) so the test owns the sample buffer."""
    s = teleop._sessions["so101-kit"]
    s.stop.set()
    s.thread.join(timeout=2)
    s.samples.clear()
    return s


def test_start_runs_teleop_and_keeps_it_between_episodes(client, fake):
    assert client.post("/capture/start", json=START).status_code == 200
    assert teleop.running("so101-kit")
    assert client.post("/capture/discard").status_code == 200
    # The follower keeps its torque between episodes
    assert teleop.running("so101-kit") and not fake.teleop.closed
    # A running session is reused by the next episode
    assert client.post("/capture/start", json=START).status_code == 200
    assert fake.teleop is teleop._sessions["so101-kit"].link


def test_saved_episode_holds_the_teleop_samples(client, fake):
    from app.services.capture import session

    client.post("/capture/start", json=START)
    s = _paused()
    start = session._session.recording_at
    # 2 s at 60 Hz, from 0.5 s before the recording to 0.5 s after it ends at 1 s
    base = start.timestamp() - 0.5
    for k in range(120):
        v = float(k)
        s.samples.append(
            _Sample(seq=k, wall=base + k / 60, t=k / 60, action=[v] * 6, state=[v - 0.5] * 6)
        )
    time.set_clock(lambda: start + timedelta(seconds=1))
    r = client.post("/capture/save", json={"outcome": "success"})
    assert r.status_code == 201, r.text
    rec = r.json()
    checks = {c["label"]: c for c in rec["checks"]}
    # Samples inside [start, start + 1 s]: 30 … 90
    assert checks["Action samples"]["value"] == "61 / 60" and checks["Action samples"]["ok"]
    assert checks["Timestamp gap"]["ok"] is True
    assert {t["name"]: t["messages"] for t in rec["topics"]}["/action"] == 61

    path = config.recordings_dir / rec["file"]
    ep = mcap_io.read_episode(path)
    t, action = ep.action
    assert action[0] == [30.0] * 6 and ep.state[1][0] == [29.5] * 6
    assert abs(t[-1] - 1.0) < 1e-6
    with path.open("rb") as f:
        from mcap.reader import make_reader

        meta = {m.name: m.metadata for m in make_reader(f).iter_metadata()}
    assert meta["episode"]["source"] == "teleop"


def test_sparse_samples_fail_the_checks(client, fake):
    from app.services.capture import session

    client.post("/capture/start", json=START)
    s = _paused()
    start = session._session.recording_at
    # Two samples in a 1 s window
    for k, dt in enumerate((0.1, 0.9)):
        s.samples.append(
            _Sample(seq=k, wall=start.timestamp() + dt, t=dt, action=[0.0] * 6, state=[0.0] * 6)
        )
    time.set_clock(lambda: start + timedelta(seconds=1))
    rec = client.post("/capture/save", json={"outcome": "fail"}).json()
    checks = {c["label"]: c for c in rec["checks"]}
    assert checks["Action samples"] == {"label": "Action samples", "value": "2 / 60", "ok": False}
    assert checks["Timestamp gap"]["value"] == "max 800 ms" and not checks["Timestamp gap"]["ok"]


def test_teleop_start_errors_block_capture(client, fake):
    from app.services.rigs import calibration
    from tests.support import FakeArm

    calibration.start("leader", FakeArm())
    r = client.post("/capture/start", json=START)
    assert r.status_code == 409
    assert client.get("/capture/state").json()["phase"] == "idle"

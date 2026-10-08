"""Teleoperation: each leader drives its follower (driver.open_teleop) in a background loop.

One session per rig. The loop runs at the rig's action rate, reads the followers every step and
keeps the last 10 minutes of samples (leader action / follower state in rig joint order) for the
live plots and for Capture, which records from them. It stops on the first error, keeping the
error for state().
"""

import logging
import threading
import time
from collections import deque
from dataclasses import dataclass, field

from app.core.errors import conflict, not_found
from app.models.rigs import TeleopJoint, TeleopPair, TeleopSamples, TeleopState
from app.services.rigs import driver
from app.services.rigs.driver import Hardware, TeleopLink
from app.utils.time import now_iso

log = logging.getLogger(__name__)

BUFFER_S = 600  # samples kept per session
LIVE_WINDOW_S = 10.0  # most a samples() call returns


@dataclass
class _Sample:
    seq: int
    wall: float  # time.time()
    t: float  # seconds since the session started
    action: list[float]
    state: list[float]


@dataclass
class _Session:
    rig_id: str
    link: TeleopLink
    pairs: list[tuple[str, str]]  # (robot id, teleop id)
    devices: list[str]
    target_hz: int
    started_at: str
    joints: list[str] = field(default_factory=list)  # rig joint order (pairs concatenated)
    samples: deque = field(default_factory=deque)
    seq: int = -1
    running: bool = True
    hz: float | None = None
    error: str | None = None
    leader: list[dict[str, float]] = field(default_factory=list)
    follower: list[dict[str, float]] = field(default_factory=list)
    stop: threading.Event = field(default_factory=threading.Event)
    thread: threading.Thread | None = None


_sessions: dict[str, _Session] = {}
# Devices held by a teleoperation outside a rig session (a leader driving Isaac Sim)
_claimed: set[str] = set()


def reset() -> None:
    for rig_id in list(_sessions):
        stop(rig_id)
    _claimed.clear()


def uses(device_id: str) -> bool:
    return device_id in _claimed or any(
        s.running and device_id in s.devices for s in _sessions.values()
    )


def claim(device_id: str) -> None:
    _claimed.add(device_id)


def release(device_id: str) -> None:
    _claimed.discard(device_id)


def running(rig_id: str) -> bool:
    s = _sessions.get(rig_id)
    return s is not None and s.running


def start(
    rig_id: str,
    pairs: list[tuple[Hardware, Hardware]],
    target_hz: int,
    devices: list[str],
    joints: list[str] | None = None,
) -> TeleopState:
    if rig_id in _sessions:
        if _sessions[rig_id].running:
            raise conflict(f"Rig '{rig_id}' is already in a teleoperation test")
        stop(rig_id)  # a stopped session (error) is replaced
    link = driver.get().open_teleop(pairs)
    s = _Session(
        rig_id=rig_id,
        link=link,
        pairs=[(r.id, t.id) for r, t in pairs],
        devices=devices,
        target_hz=target_hz,
        started_at=now_iso(),
        leader=[{} for _ in pairs],
        follower=[{} for _ in pairs],
        samples=deque(maxlen=target_hz * BUFFER_S),
    )
    motors = [m for names in link.joints for m in names]
    # Rig joint names when they line up with the arms' motors (bimanual rigs prefix them)
    s.joints = list(joints) if joints and len(joints) == len(motors) else motors
    _sessions[rig_id] = s
    s.thread = threading.Thread(target=_loop, args=(s,), daemon=True)
    s.thread.start()
    return _view(s)


def exists(rig_id: str) -> bool:
    return rig_id in _sessions


def state(rig_id: str) -> TeleopState:
    s = _sessions.get(rig_id)
    if s is None:
        raise not_found("Teleoperation", rig_id)
    return _view(s)


def samples(rig_id: str, after: int = -1) -> TeleopSamples:
    """Samples with seq > after, at most the last LIVE_WINDOW_S seconds."""
    s = _sessions.get(rig_id)
    if s is None:
        raise not_found("Teleoperation", rig_id)
    rows = list(s.samples)
    if rows:
        newest = rows[-1].t
        rows = [r for r in rows if r.seq > after and r.t >= newest - LIVE_WINDOW_S]
    return TeleopSamples(
        joints=s.joints,
        seq=rows[-1].seq if rows else after,
        t=[round(r.t, 4) for r in rows],
        action=[[round(v, 3) for v in r.action] for r in rows],
        state=[[round(v, 3) for v in r.state] for r in rows],
    )


def samples_between(
    rig_id: str, start_wall: float, end_wall: float
) -> tuple[list[float], list[list[float]], list[list[float]]]:
    """Samples whose wall time falls in [start_wall, end_wall]; t is seconds from start_wall."""
    s = _sessions.get(rig_id)
    if s is None:
        return [], [], []
    rows = [r for r in list(s.samples) if start_wall <= r.wall <= end_wall]
    return (
        [r.wall - start_wall for r in rows],
        [list(r.action) for r in rows],
        [list(r.state) for r in rows],
    )


def stop(rig_id: str) -> None:
    s = _sessions.pop(rig_id, None)
    if s is None:
        raise not_found("Teleoperation", rig_id)
    s.stop.set()
    if s.thread is not None and s.thread is not threading.current_thread():
        s.thread.join(timeout=2)
    _close(s)


def _close(s: _Session) -> None:
    s.running = False
    try:
        s.link.close()
    except Exception:
        log.exception("Closing teleoperation of %s failed", s.rig_id)


def _loop(s: _Session) -> None:
    period = 1 / s.target_hz
    t0 = time.perf_counter()
    window_start, window_steps = t0, 0
    next_t = t0
    while not s.stop.is_set():
        try:
            # Followers are read every step: Capture records observation.state from them
            out = s.link.step(read_follower=True)
        except Exception as e:
            log.exception("Teleoperation of %s failed", s.rig_id)
            s.error = str(e) or type(e).__name__
            _close(s)
            return
        wall, at = time.time(), time.perf_counter() - t0
        action: list[float] = []
        state: list[float] = []
        for i, (lead, follow) in enumerate(out):
            s.leader[i] = lead
            if follow is not None:
                s.follower[i] = follow
            names = s.link.joints[i]
            action += [lead.get(m, 0.0) for m in names]
            state += [s.follower[i].get(m, 0.0) for m in names]
        s.seq += 1
        s.samples.append(_Sample(seq=s.seq, wall=wall, t=at, action=action, state=state))
        window_steps += 1
        now = time.perf_counter()
        if now - window_start >= 1.0:
            s.hz = round(window_steps / (now - window_start), 1)
            window_start, window_steps = now, 0
        next_t += period
        delay = next_t - time.perf_counter()
        if delay > 0:
            s.stop.wait(delay)
        else:
            next_t = time.perf_counter()  # fell behind: don't burst to catch up


def _view(s: _Session) -> TeleopState:
    pairs = []
    for i, (robot, teleop) in enumerate(s.pairs):
        names = s.link.joints[i] if i < len(s.link.joints) else []
        joints = [
            TeleopJoint(name=m, leader=s.leader[i].get(m), follower=s.follower[i].get(m))
            for m in names
        ]
        pairs.append(TeleopPair(robot=robot, teleop=teleop, joints=joints))
    return TeleopState(
        rig_id=s.rig_id,
        running=s.running,
        hz=s.hz,
        target_hz=s.target_hz,
        error=s.error,
        started_at=s.started_at,
        pairs=pairs,
    )

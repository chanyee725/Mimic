"""Teleoperation test: each leader drives its follower (driver.open_teleop) in a background loop.

One session per rig. The loop runs at the rig's action rate, reads followers every few steps
(for display) and stops on the first error, keeping the error for state().
"""

import logging
import threading
import time
from dataclasses import dataclass, field

from app.core.errors import conflict, not_found
from app.models.rigs import TeleopJoint, TeleopPair, TeleopState
from app.services.rigs import driver
from app.services.rigs.driver import Hardware, TeleopLink
from app.utils.time import now_iso

log = logging.getLogger(__name__)

FOLLOWER_EVERY = 6  # steps between follower reads


@dataclass
class _Session:
    rig_id: str
    link: TeleopLink
    pairs: list[tuple[str, str]]  # (robot id, teleop id)
    devices: list[str]
    target_hz: int
    started_at: str
    running: bool = True
    hz: float | None = None
    error: str | None = None
    leader: list[dict[str, float]] = field(default_factory=list)
    follower: list[dict[str, float]] = field(default_factory=list)
    stop: threading.Event = field(default_factory=threading.Event)
    thread: threading.Thread | None = None


_sessions: dict[str, _Session] = {}


def reset() -> None:
    for rig_id in list(_sessions):
        stop(rig_id)


def uses(device_id: str) -> bool:
    return any(s.running and device_id in s.devices for s in _sessions.values())


def start(
    rig_id: str, pairs: list[tuple[Hardware, Hardware]], target_hz: int, devices: list[str]
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
    )
    _sessions[rig_id] = s
    s.thread = threading.Thread(target=_loop, args=(s,), daemon=True)
    s.thread.start()
    return _view(s)


def state(rig_id: str) -> TeleopState:
    s = _sessions.get(rig_id)
    if s is None:
        raise not_found("Teleoperation", rig_id)
    return _view(s)


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
    n, window_start, window_steps = 0, time.perf_counter(), 0
    next_t = time.perf_counter()
    while not s.stop.is_set():
        try:
            out = s.link.step(read_follower=n % FOLLOWER_EVERY == 0)
        except Exception as e:
            log.exception("Teleoperation of %s failed", s.rig_id)
            s.error = str(e) or type(e).__name__
            _close(s)
            return
        for i, (lead, follow) in enumerate(out):
            s.leader[i] = lead
            if follow is not None:
                s.follower[i] = follow
        n += 1
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

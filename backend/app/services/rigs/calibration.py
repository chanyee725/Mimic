"""Arm calibration as a session the web steps through (LeRobot's calibrate() without input()).

center: torque off, the operator puts every joint in the middle of its range → next() writes
half-turn homing offsets. range: the operator sweeps every joint (except full-turn ones) while a
reader thread records min / max → next() writes the calibration to the motors and saves the
LeRobot calibration file. Positions are read in the background; state() never touches the bus.
"""

import logging
import threading
from dataclasses import dataclass, field

from app.core.errors import ApiError, conflict, not_found
from app.models.rigs import CalibrationSession, CalibrationStep, MotorRange
from app.services.rigs.driver import Arm
from app.utils.time import now_iso

log = logging.getLogger(__name__)

READ_PERIOD_S = 0.02

MESSAGES: dict[CalibrationStep, str] = {
    "center": "Move every joint to the middle of its range, then continue.",
    "range": "Move every joint through its full range, then finish.",
    "done": "Calibration saved.",
    "failed": "Calibration failed.",
}


@dataclass
class _Session:
    device_id: str
    arm: Arm
    started_at: str
    step: CalibrationStep = "center"
    message: str = MESSAGES["center"]
    homings: dict[str, int] = field(default_factory=dict)
    pos: dict[str, int] = field(default_factory=dict)
    mins: dict[str, int] = field(default_factory=dict)
    maxes: dict[str, int] = field(default_factory=dict)
    file: str | None = None
    lock: threading.Lock = field(default_factory=threading.Lock)
    stop: threading.Event = field(default_factory=threading.Event)
    reader: threading.Thread | None = None

    @property
    def active(self) -> bool:
        return self.step in ("center", "range")


_sessions: dict[str, _Session] = {}


def reset() -> None:
    for s in list(_sessions.values()):
        _close(s)
    _sessions.clear()


def active(device_id: str) -> bool:
    s = _sessions.get(device_id)
    return s is not None and s.active


def start(device_id: str, arm: Arm) -> CalibrationSession:
    """Takes an opened arm; a finished session of the same device is replaced."""
    if active(device_id):
        arm.close()
        raise conflict(f"Device '{device_id}' is already calibrating")
    s = _Session(device_id=device_id, arm=arm, started_at=now_iso())
    try:
        arm.prepare()
        s.pos = arm.positions()
    except Exception as e:
        arm.close()
        raise ApiError(503, f"Cannot prepare '{device_id}' for calibration: {e}") from e
    _sessions[device_id] = s
    s.reader = threading.Thread(target=_read_loop, args=(s,), daemon=True)
    s.reader.start()
    return _view(s)


def state(device_id: str) -> CalibrationSession:
    s = _sessions.get(device_id)
    if s is None:
        raise not_found("Calibration", device_id)
    return _view(s)


def advance(device_id: str) -> CalibrationSession:
    """center → range (write homings) → done (write and save the calibration)."""
    s = _sessions.get(device_id)
    if s is None or not s.active:
        raise conflict(f"Device '{device_id}' is not calibrating")
    with s.lock:
        if s.step == "center":
            _run(s, _set_homings)
        else:
            # Joints that never moved would get an empty range: keep recording until they do
            still = [m for m in _ranged(s) if s.mins.get(m) == s.maxes.get(m)]
            if still:
                raise conflict("Some joints have not moved yet", motors=still)
            _run(s, _save)
    if not s.active:
        _close(s)
    return _view(s)


def cancel(device_id: str) -> None:
    s = _sessions.pop(device_id, None)
    if s is None:
        raise not_found("Calibration", device_id)
    _close(s)


def _ranged(s: _Session) -> list[str]:
    return [m for m in s.arm.motors if m not in s.arm.full_turn]


def _set_homings(s: _Session) -> None:
    s.homings = s.arm.set_homings()
    s.pos = s.arm.positions()
    s.mins = {m: s.pos[m] for m in _ranged(s)}
    s.maxes = dict(s.mins)
    s.step, s.message = "range", MESSAGES["range"]


def _save(s: _Session) -> None:
    s.file = s.arm.save(s.homings, s.mins, s.maxes)
    s.step, s.message = "done", MESSAGES["done"]


def _run(s: _Session, fn) -> None:
    try:
        fn(s)
    except Exception as e:
        log.exception("Calibration of %s failed", s.device_id)
        s.step, s.message = "failed", f"{MESSAGES['failed']} {e}"


def _read_loop(s: _Session) -> None:
    while not s.stop.wait(READ_PERIOD_S):
        with s.lock:
            if not s.active:
                return
            try:
                pos = s.arm.positions()
            except Exception as e:
                log.exception("Calibration read of %s failed", s.device_id)
                s.step, s.message = "failed", f"{MESSAGES['failed']} {e}"
                s.arm.close()
                return
            s.pos = pos
            if s.step == "range":
                for m in s.mins:
                    s.mins[m] = min(s.mins[m], pos[m])
                    s.maxes[m] = max(s.maxes[m], pos[m])


def _close(s: _Session) -> None:
    s.stop.set()
    if s.reader is not None and s.reader is not threading.current_thread():
        s.reader.join(timeout=1)
    try:
        s.arm.close()
    except Exception:
        log.exception("Closing %s failed", s.device_id)
    if s.active:
        s.step, s.message = "failed", "Cancelled."


def _view(s: _Session) -> CalibrationSession:
    motors = [
        MotorRange(
            name=m,
            pos=s.pos.get(m),
            min=s.mins.get(m),
            max=s.maxes.get(m),
            full_turn=m in s.arm.full_turn,
        )
        for m in s.arm.motors
    ]
    return CalibrationSession(
        device_id=s.device_id,
        step=s.step,
        message=s.message,
        motors=motors,
        file=s.file,
        started_at=s.started_at,
    )

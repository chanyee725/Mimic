"""Isaac Sim teleoperation: a leader arm drives the robot opened alone in Isaac Sim.

One session at a time. Start opens the robot (runner.open_asset) and the leader, then a thread
waits for the app to show the robot's scene, plays the timeline and sends the leader's joints
to the server at TARGET_HZ (runner.send_joints). Joints match by name: a LeRobot follower's
USD names its joints after the motors (so101_follower: shoulder_pan, …, gripper), so the leader
X_leader drives the robot X_follower; the gripper goes as 0–100 over its joint limits.

The device "keyboard" drives any robot instead: the page sends jog speeds per joint while keys
are held (set_jog), the loop forwards them at TARGET_HZ and the app moves the drive targets,
stopping at the limits. Speeds not refreshed within JOG_HOLD_S drop to zero.
"""

import logging
import threading
import time
from dataclasses import dataclass, field

from app.core.errors import ApiError, conflict, not_found
from app.models.simulation import SimAsset, SimTeleop, SimTeleopJoint
from app.services import rigs
from app.services.rigs.driver import LeaderLink
from app.services.simulation import runner
from app.services.simulation.envs import get_robot, leader_types, robot_path, set_leader_rest
from app.utils.time import now_iso

log = logging.getLogger(__name__)

TARGET_HZ = 30
SCENE_TIMEOUT_S = 600.0  # a first Isaac Sim start compiles shaders for minutes
SCENE_POLL_S = 0.5
PERCENT_JOINTS = ["gripper"]
KEYBOARD = "keyboard"
JOG_HOLD_S = 0.5
MAX_JOG_DEG_S = 120.0
MAX_TWIST = (0.25, 90.0)  # m/s, deg/s
SEND_FAIL_S = 5.0  # a session stops after sending fails this long (the app still running)


@dataclass
class _Session:
    robot_id: str
    device_id: str
    link: LeaderLink | None  # None for the keyboard
    started_at: str
    state: str = "starting"
    hz: float | None = None
    error: str | None = None
    values: dict[str, float] = field(default_factory=dict)
    tcp: list[float] | None = None
    jog: dict[str, float] = field(default_factory=dict)  # keyboard: joint → degrees per second
    twist: list[float] | None = None  # keyboard: TCP twist (tool frame; m/s, deg/s)
    jog_at: float = 0.0  # time.monotonic() of the last set_jog
    stop: threading.Event = field(default_factory=threading.Event)
    thread: threading.Thread | None = None


_lock = threading.Lock()
_session: _Session | None = None


def reset() -> None:
    if _session is not None:
        stop()


def state() -> SimTeleop | None:
    s = _session
    return _view(s) if s else None


def start(robot_id: str, device_id: str, display: str | None = None) -> SimTeleop:
    global _session
    keyboard = device_id == KEYBOARD
    if keyboard:
        if robot_path(robot_id) is None:
            raise not_found("Robot", robot_id)
    else:
        _check_pair(robot_id, device_id)
    with _lock:
        if _session is not None and _session.state != "stopped":
            raise conflict(f"Isaac Sim teleoperation of {_session.robot_id} is running; stop it")
        if _session is not None:
            _end(_session)
            _session = None
        version = runner.server_version()
        if version is not None and version < runner.JOINTS_VERSION and not runner.is_local():
            raise ApiError(
                409, "The Isaac Sim server is too old for teleoperation; update and restart it"
            )
        link = None if keyboard else rigs.open_leader(device_id)
        try:
            runner.open_asset("robot", robot_id, display)
        except BaseException:
            if link is not None:
                link.close()
                rigs.release_leader(device_id)
            raise
        s = _Session(robot_id=robot_id, device_id=device_id, link=link, started_at=now_iso())
        _session = s
    s.thread = threading.Thread(target=_loop, args=(s,), daemon=True)
    s.thread.start()
    return _view(s)


def set_jog(velocities: dict[str, float] | None = None, twist: list[float] | None = None) -> None:
    """Keyboard: the joints to move now (degrees per second), or the TCP twist (its own frame;
    m/s, deg/s), capped; {} or zeros stop. 422 for a twist when the robot has no TCP."""
    s = _session
    if s is None or s.device_id != KEYBOARD:
        raise not_found("Keyboard teleoperation", "isaac-sim")
    if s.state != "running":
        raise conflict(f"Teleoperation is {s.state}")
    if twist is not None:
        if get_robot(s.robot_id).tcp is None:
            raise ApiError(422, f"Robot '{s.robot_id}' has no TCP (robot.yaml tcp)")
        caps = [MAX_TWIST[0]] * 3 + [MAX_TWIST[1]] * 3
        s.twist = [max(-c, min(c, float(v))) for v, c in zip(twist, caps)]
        s.jog = {}
    else:
        s.twist = None
        s.jog = {
            j: max(-MAX_JOG_DEG_S, min(MAX_JOG_DEG_S, float(v)))
            for j, v in (velocities or {}).items()
        }
    s.jog_at = time.monotonic()


def stop() -> None:
    """Disconnects the leader; the Isaac Sim scene stays open."""
    global _session
    with _lock:
        s, _session = _session, None
    if s is None:
        raise not_found("Teleoperation", "isaac-sim")
    _end(s)


CAPTURE_READS = 5


def _check_pair(robot_id: str, device_id: str) -> str:
    """The leader's type; 404 for an unknown robot / device, 422 when it cannot drive the robot."""
    if robot_path(robot_id) is None:
        raise not_found("Robot", robot_id)
    leader_type = rigs.device_type(device_id)
    if leader_type not in leader_types(robot_id):
        raise ApiError(
            422,
            f"'{device_id}' ({leader_type}) cannot drive {robot_id}",
            {"teleop": leader_types(robot_id)},
        )
    return leader_type


def capture_leader_rest(robot_id: str, device_id: str) -> SimAsset:
    """The leader's present position (median of a few reads; the running session's last one when
    it drives the simulation) is saved as what it reads in the robot's initial pose, so
    teleoperation lines the two up."""
    leader_type = _check_pair(robot_id, device_id)
    s = _session
    if s is not None and s.device_id == device_id and s.state == "running" and s.values:
        pose = dict(s.values)
    else:
        link = rigs.open_leader(device_id)
        try:
            reads = [link.read() for _ in range(CAPTURE_READS)]
        finally:
            link.close()
            rigs.release_leader(device_id)
        pose = {m: sorted(r[m] for r in reads)[len(reads) // 2] for m in reads[0]}
    return set_leader_rest(robot_id, pose, f"{leader_type} ({device_id})")


def _end(s: _Session) -> None:
    s.stop.set()
    if s.thread is not None and s.thread is not threading.current_thread():
        s.thread.join(timeout=3)
    _close(s)


def _close(s: _Session) -> None:
    if s.link is None:
        return
    try:
        s.link.close()
    except Exception:
        log.exception("Closing the leader %s failed", s.device_id)
    rigs.release_leader(s.device_id)


def _fail(s: _Session, message: str) -> None:
    s.state, s.error = "stopped", message
    _close(s)


def _scene_ready(s: _Session) -> bool:
    """True once the app shows the robot's scene; raises when the app exits or the build fails."""
    app = runner.status().app
    if app is None:
        return False
    if app.state == "exited" or app.error:
        raise RuntimeError(app.error or "Isaac Sim exited")
    return app.state == "running" and app.scene == runner.scene_id("robot", s.robot_id)


def _app_gone() -> str | None:
    """Why sending failed when the app is not running any more (window closed, Stop, crash)."""
    try:
        app = runner.status().app
    except Exception:
        return None
    if app is None:
        return "The Isaac Sim server stopped"
    if app.state != "running":
        return app.error or "Isaac Sim was closed (window closed or app stopped)"
    return None


def _loop(s: _Session) -> None:
    deadline = time.monotonic() + SCENE_TIMEOUT_S
    try:
        while not _scene_ready(s):
            if time.monotonic() > deadline:
                return _fail(s, "Isaac Sim did not open the robot in time")
            if s.stop.wait(SCENE_POLL_S):
                return
    except Exception as e:
        return _fail(s, str(e))
    s.state = "running"
    period = 1 / TARGET_HZ
    window_start, window_steps = time.perf_counter(), 0
    next_t, first = time.perf_counter(), True
    failing_since: float | None = None
    while not s.stop.is_set():
        try:
            if s.link is None:
                fresh = time.monotonic() - s.jog_at < JOG_HOLD_S
                runner.send_jog(s.jog if fresh else {}, s.twist if fresh else None, play=first)
            else:
                s.values = s.link.read()
                runner.send_joints(s.values, PERCENT_JOINTS, play=first)
            first, failing_since = False, None
        except Exception as e:
            message = getattr(e, "message", None) or str(e) or type(e).__name__
            gone = _app_gone()
            failing_since = failing_since or time.monotonic()
            if gone or s.link is not None and not isinstance(e, ApiError):
                log.exception("Isaac Sim teleoperation of %s failed", s.robot_id)
                return _fail(s, gone or message)
            if time.monotonic() - failing_since > SEND_FAIL_S:
                return _fail(s, message)
            log.warning("Isaac Sim teleoperation of %s: %s (retrying)", s.robot_id, message)
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
            next_t = time.perf_counter()


def _view(s: _Session) -> SimTeleop:
    if s.link is None:
        # Keyboard: the robot's drive targets as the app reports them
        app = runner.status().app if s.state == "running" else None
        s.values = dict((app.joints if app else None) or s.values)
        s.tcp = app.tcp if app else None
    names = list(getattr(s.link, "joints", None) or s.values)
    return SimTeleop(
        robot_id=s.robot_id,
        device_id=s.device_id,
        state=s.state,
        hz=s.hz if s.state == "running" else None,
        target_hz=TARGET_HZ,
        error=s.error,
        started_at=s.started_at,
        joints=[SimTeleopJoint(name=n, value=s.values.get(n)) for n in names],
        tcp=s.tcp,
    )

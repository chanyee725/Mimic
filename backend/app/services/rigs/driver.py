"""Device access for the Rigs page: connection tests and arm calibration through LeRobot.

LeRobot is imported lazily (it pulls in torch), so the station runs without it; every call then
answers 503. Calibration files live in data/calibration (LeRobot's layout). Tests run with
VLA_DEVICE_DRIVER=none or install a fake with use().
"""

import importlib
import logging
import os
import pkgutil
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from collections.abc import Iterator
from typing import Any, Literal, Protocol

from app.configs.config import config
from app.core.errors import ApiError

log = logging.getLogger(__name__)

Kind = Literal["robot", "teleop", "camera"]


@dataclass
class Hardware:
    """What the rig file says about one device (port already resolved)."""

    id: str
    kind: Kind
    type: str  # LeRobot type (so101_follower, so101_leader, opencv)
    port: str
    calibration_id: str = ""  # LeRobot id: names the calibration file
    width: int = 0
    height: int = 0
    fps: int = 0


@dataclass
class ArmReport:
    motors: dict[str, bool]  # name → answered a ping
    voltage: float | None = None  # V, lowest motor
    temperature: int | None = None  # °C, hottest motor
    matches_file: bool | None = None  # motor registers vs the calibration file (None: no file)


@dataclass
class CameraReport:
    width: int
    height: int
    fps: float  # measured


class Arm(Protocol):
    """An arm opened for calibration (torque off while it is open)."""

    motors: list[str]
    full_turn: list[str]  # motors whose range is not recorded

    def prepare(self) -> None: ...
    def set_homings(self) -> dict[str, int]: ...
    def positions(self) -> dict[str, int]: ...
    def save(self, homings: dict[str, int], mins: dict[str, int], maxes: dict[str, int]) -> str: ...
    def close(self) -> None: ...


class TeleopLink(Protocol):
    """Leader → follower pairs, connected with torque on the followers."""

    joints: list[list[str]]  # per pair, in action order

    def step(self, read_follower: bool) -> list[tuple[dict[str, float], dict[str, float] | None]]:
        """One control step: read every leader and command its follower; per pair (leader,
        follower positions when read_follower — the teleop service asks every step)."""
        ...

    def close(self) -> None: ...


class Driver(Protocol):
    def unavailable(self) -> str | None: ...
    def calibration_file(self, hw: Hardware) -> Path | None: ...
    def test_arm(self, hw: Hardware) -> ArmReport: ...
    def test_camera(self, hw: Hardware) -> CameraReport: ...
    def open_arm(self, hw: Hardware) -> Arm: ...
    def camera_frames(self, port: str) -> Iterator[bytes]: ...
    def open_teleop(self, pairs: list[tuple[Hardware, Hardware]]) -> TeleopLink: ...


class NoDriver:
    """No device access (tests, or a station without LeRobot)."""

    reason = "Device access is disabled (VLA_DEVICE_DRIVER=none)"

    def unavailable(self) -> str | None:
        return self.reason

    def calibration_file(self, hw: Hardware) -> Path | None:
        return None

    def test_arm(self, hw: Hardware) -> ArmReport:
        raise ApiError(503, self.reason)

    def test_camera(self, hw: Hardware) -> CameraReport:
        raise ApiError(503, self.reason)

    def open_arm(self, hw: Hardware) -> Arm:
        raise ApiError(503, self.reason)

    def camera_frames(self, port: str) -> Iterator[bytes]:
        raise ApiError(503, self.reason)

    def open_teleop(self, pairs: list[tuple[Hardware, Hardware]]) -> TeleopLink:
        raise ApiError(503, self.reason)


# --- LeRobot -------------------------------------------------------------------


def _use_data_calibration() -> None:
    """Point LeRobot at data/calibration. LeRobot reads HF_LEROBOT_CALIBRATION once, when it is
    first imported, so this runs before any import of it (the driver is the only importer)."""
    os.environ["HF_LEROBOT_CALIBRATION"] = str(config.calibration_dir)
    if "lerobot.utils.constants" in sys.modules:
        log.warning("LeRobot was imported before the driver: calibration files may not be in data/")


def _choice(base: Any, package: str, name: str) -> Any:
    """Config class registered under `name`; LeRobot registers a type when its package is imported."""
    known = getattr(base, "_choice_registry", {})
    if name in known:
        return known[name]
    pkg = importlib.import_module(package)
    # so101_follower lives in so_follower: try the digit-free name first, then every sub-package
    guess = "".join(c for c in name if not c.isdigit())
    names = [guess] + [m.name for m in pkgutil.iter_modules(pkg.__path__) if m.ispkg]
    for sub in names:
        try:
            importlib.import_module(f"{package}.{sub}")
        except Exception:  # optional SDKs of other robots may be missing
            continue
        if name in known:
            return known[name]
    raise ApiError(400, f"LeRobot has no type '{name}'")


def _lerobot_device(hw: Hardware, **options: Any) -> Any:
    """LeRobot robot / teleoperator for an arm (nothing is opened)."""
    if hw.kind == "robot":
        from lerobot.robots import RobotConfig, make_robot_from_config

        cfg = _choice(RobotConfig, "lerobot.robots", hw.type)
        return make_robot_from_config(cfg(port=hw.port, id=hw.calibration_id, **options))
    from lerobot.teleoperators import TeleoperatorConfig, make_teleoperator_from_config

    cfg = _choice(TeleoperatorConfig, "lerobot.teleoperators", hw.type)
    return make_teleoperator_from_config(cfg(port=hw.port, id=hw.calibration_id))


def _feetech_bus(device: Any) -> Any:
    bus = getattr(device, "bus", None)
    if bus is None or type(bus).__name__ != "FeetechMotorsBus":
        # Other buses (Dynamixel, …) calibrate differently: use lerobot-calibrate for them
        raise ApiError(400, "Only Feetech arms (SO-100 / SO-101) are supported here")
    return bus


def _port_error(port: str, e: Exception) -> ApiError:
    return ApiError(503, f"Cannot open {port}: {e}")


class LeRobotDriver:
    def __init__(self) -> None:
        _use_data_calibration()

    def unavailable(self) -> str | None:
        try:
            importlib.import_module("lerobot")
        except ImportError:
            return "LeRobot is not installed (cd backend && uv sync)"
        return None

    def _require(self) -> None:
        if reason := self.unavailable():
            raise ApiError(503, reason)

    def calibration_file(self, hw: Hardware) -> Path | None:
        if hw.kind == "camera" or self.unavailable():
            return None
        try:
            path = _lerobot_device(hw).calibration_fpath
        except Exception:
            return None
        return path if path.is_file() else None

    def test_arm(self, hw: Hardware) -> ArmReport:
        self._require()
        device = _lerobot_device(hw)
        bus = _feetech_bus(device)
        try:
            bus.connect(handshake=False)  # opens the port only; nothing is written
        except Exception as e:
            raise _port_error(hw.port, e) from e
        try:
            found = {m: bus.ping(m) is not None for m in bus.motors}
            report = ArmReport(motors=found)
            present = [m for m, ok in found.items() if ok]
            if present:
                volts = bus.sync_read("Present_Voltage", present, normalize=False)
                temps = bus.sync_read("Present_Temperature", present, normalize=False)
                report.voltage = min(volts.values()) / 10
                report.temperature = max(temps.values())
            if device.calibration and len(present) == len(found):
                report.matches_file = bool(bus.is_calibrated)
            return report
        finally:
            bus.disconnect(disable_torque=False)

    def test_camera(self, hw: Hardware) -> CameraReport:
        self._require()
        from lerobot.cameras.opencv import OpenCVCamera, OpenCVCameraConfig

        cam = OpenCVCamera(
            OpenCVCameraConfig(
                index_or_path=Path(hw.port), fps=hw.fps, width=hw.width, height=hw.height
            )
        )
        try:
            # Fails when the camera cannot deliver the rig's resolution / fps
            cam.connect()
        except Exception as e:
            raise _port_error(hw.port, e) from e
        try:
            n, t0 = 0, time.perf_counter()
            while time.perf_counter() - t0 < 1.0:
                cam.async_read(timeout_ms=1000)
                n += 1
            fps = n / (time.perf_counter() - t0)
            return CameraReport(width=cam.width, height=cam.height, fps=fps)
        finally:
            cam.disconnect()

    def open_arm(self, hw: Hardware) -> Arm:
        self._require()
        return _LeRobotArm(_lerobot_device(hw), hw.port)

    def camera_frames(self, port: str) -> Iterator[bytes]:
        """JPEG frames from a video port at a preview rate (MJPG 640×480); stops when closed."""
        self._require()
        import cv2

        cap = cv2.VideoCapture(port, cv2.CAP_V4L2)
        if not cap.isOpened():
            cap.release()
            raise ApiError(503, f"Cannot open {port}")
        cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        return _jpegs(cap)

    def open_teleop(self, pairs: list[tuple[Hardware, Hardware]]) -> TeleopLink:
        self._require()
        return _LeRobotTeleop(pairs)


@dataclass
class _LeRobotArm:
    """Mirrors SOFollower.calibrate() / SOLeader.calibrate(), one step per call instead of input()."""

    device: Any
    port: str
    motors: list[str] = field(init=False)
    full_turn: list[str] = field(init=False)

    def __post_init__(self) -> None:
        self.bus = _feetech_bus(self.device)
        try:
            self.bus.connect()  # handshake: every motor must answer
        except Exception as e:
            raise _port_error(self.port, e) from e
        self.motors = list(self.bus.motors)
        self.full_turn = [m for m in self.motors if m == "wrist_roll"]

    def prepare(self) -> None:
        from lerobot.motors.feetech import OperatingMode

        self.bus.disable_torque()
        for m in self.motors:
            self.bus.write("Operating_Mode", m, OperatingMode.POSITION.value)

    def set_homings(self) -> dict[str, int]:
        return self.bus.set_half_turn_homings()

    def positions(self) -> dict[str, int]:
        return self.bus.sync_read("Present_Position", normalize=False, num_retry=5)

    def save(self, homings: dict[str, int], mins: dict[str, int], maxes: dict[str, int]) -> str:
        from lerobot.motors import MotorCalibration

        top = {
            m: self.bus.model_resolution_table[self.bus.motors[m].model] - 1 for m in self.motors
        }
        cal = {
            m: MotorCalibration(
                id=self.bus.motors[m].id,
                drive_mode=0,
                homing_offset=homings[m],
                range_min=0 if m in self.full_turn else mins[m],
                range_max=top[m] if m in self.full_turn else maxes[m],
            )
            for m in self.motors
        }
        self.bus.write_calibration(cal)
        self.device.calibration = cal
        self.device._save_calibration()
        return str(self.device.calibration_fpath)

    def close(self) -> None:
        if self.bus.is_connected:
            self.bus.disconnect(disable_torque=False)


def _jpegs(cap: Any) -> Iterator[bytes]:
    import cv2

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                return
            ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
            if ok:
                yield buf.tobytes()
    finally:
        cap.release()


# On start the follower is eased from its own pose to the leader's over this long (by time, not
# capped per step against the present position, which made it crawl); afterwards it gets the
# leader's action as is, like lerobot-teleoperate
RAMP_S = 1.5


class _LeRobotTeleop:
    def __init__(self, pairs: list[tuple[Hardware, Hardware]]):
        self.pairs: list[tuple[Any, Any]] = []
        self.starts: list[dict[str, float]] = []  # follower pose at connect, per pair
        self.t0: float | None = None
        try:
            for robot_hw, leader_hw in pairs:
                leader = _lerobot_device(leader_hw)
                robot = _lerobot_device(robot_hw)
                for hw, dev in ((leader_hw, leader), (robot_hw, robot)):
                    if not dev.calibration:
                        raise ApiError(409, f"Calibrate '{hw.id}' first")
                self.pairs.append((leader, robot))
                # Leader first: the follower gets torque on connect
                _connect_calibrated(leader, leader_hw.port)
                _connect_calibrated(robot, robot_hw.port)
                pose = robot.bus.sync_read("Present_Position", num_retry=2)
                self.starts.append({f"{m}.pos": float(v) for m, v in pose.items()})
        except BaseException:
            self.close()
            raise
        self.joints = [[k.removesuffix(".pos") for k in r.action_features] for _, r in self.pairs]

    def step(self, read_follower: bool) -> list[tuple[dict[str, float], dict[str, float] | None]]:
        now = time.perf_counter()
        if self.t0 is None:
            self.t0 = now
        ramp = min(1.0, (now - self.t0) / RAMP_S)
        out = []
        for (leader, robot), start in zip(self.pairs, self.starts):
            action = leader.get_action()
            if ramp < 1.0:
                robot.send_action({k: start[k] + (v - start[k]) * ramp for k, v in action.items()})
            else:
                robot.send_action(action)
            follower = None
            if read_follower:
                obs = robot.bus.sync_read("Present_Position", num_retry=2)
                follower = {m: float(v) for m, v in obs.items()}
            out.append(({k.removesuffix(".pos"): float(v) for k, v in action.items()}, follower))
        return out

    def close(self) -> None:
        for pair in self.pairs:
            for dev in pair:
                if dev.is_connected:
                    try:
                        dev.disconnect()  # followers drop torque (LeRobot default)
                    except Exception:
                        pass
        self.pairs = []


def _connect_calibrated(device: Any, port: str) -> None:
    """connect() without LeRobot's interactive calibrate(): the file is written to the motors
    when they hold something else (what pressing ENTER at its prompt does)."""
    try:
        device.bus.connect()
    except Exception as e:
        raise _port_error(port, e) from e
    if not device.bus.is_calibrated:
        device.bus.write_calibration(device.calibration)
    device.configure()


_driver: Driver | None = None


def get() -> Driver:
    global _driver
    if _driver is None:
        _driver = LeRobotDriver() if config.device_driver == "lerobot" else NoDriver()
    return _driver


def use(driver: Driver | None) -> None:
    """Tests install a fake; None goes back to the configured driver."""
    global _driver
    _driver = driver

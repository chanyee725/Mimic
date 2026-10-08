"""Rig and device entities."""

from typing import Literal

from app.schemas.common import CamelModel


class RigCamera(CamelModel):
    id: str
    key: str
    name: str
    feature: str
    resolution: str
    fps: int
    default_on: bool


class TargetHz(CamelModel):
    action: int
    video: int


class Rig(CamelModel):
    id: str
    name: str
    master: str
    slave: str
    robots: list[str]
    devices: list[str]
    cameras: list[RigCamera]
    joints: list[str]
    target_hz: TargetHz
    action_hz_options: list[int]
    video_fps_options: list[int]


DeviceType = Literal["robot", "teleop", "camera", "glove", "input"]
Health = Literal["ok", "warn", "off"]


class DeviceStream(CamelModel):
    key: str
    shape: str
    target_hz: float | None
    measured_hz: float | None
    unit: Literal["Hz", "fps"]


class Calibration(CamelModel):
    done: bool
    note: str


class Stat(CamelModel):
    label: str
    value: str


class DeviceCheck(CamelModel):
    """Result of the last connection test."""

    ok: bool
    message: str
    at: str  # ISO 8601


class Device(CamelModel):
    id: str
    name: str
    type: DeviceType
    driver: str | None = None  # LeRobot type from the rig file (so101_leader, …); None for cameras
    port: str
    health: Health
    calibration: Calibration
    streams: list[DeviceStream]
    stats: list[Stat]
    check: DeviceCheck | None = None


PortKind = Literal["serial", "video"]


class Port(CamelModel):
    """A serial or video port found on the station."""

    path: str  # stable path to store (/dev/serial/by-id/… when there is one)
    device: str  # kernel node (/dev/ttyACM0)
    kind: PortKind
    label: str  # USB product name
    used_by: list[str]  # device ids assigned to this port


CalibrationStep = Literal["center", "range", "done", "failed"]


class MotorRange(CamelModel):
    name: str
    pos: int | None
    min: int | None
    max: int | None
    full_turn: bool  # range is not recorded (e.g. wrist_roll)


class CalibrationSession(CamelModel):
    """Step-by-step arm calibration (LeRobot): center the arm, then sweep every joint."""

    device_id: str
    step: CalibrationStep
    message: str
    motors: list[MotorRange]
    file: str | None  # LeRobot calibration file, once saved
    started_at: str


class TeleopJoint(CamelModel):
    name: str
    leader: float | None
    follower: float | None


class TeleopPair(CamelModel):
    robot: str  # follower device id
    teleop: str  # leader device id
    joints: list[TeleopJoint]


class TeleopState(CamelModel):
    """Teleoperation test of a rig: every leader drives its follower."""

    rig_id: str
    running: bool
    hz: float | None  # measured loop rate
    target_hz: int
    error: str | None
    started_at: str
    pairs: list[TeleopPair]


class TeleopSamples(CamelModel):
    """Recent teleoperation samples for live plots (rig joint order)."""

    joints: list[str]
    seq: int  # last returned sample, or `after` when none
    t: list[float]  # seconds since the session started
    action: list[list[float]]  # leader
    state: list[list[float]]  # follower

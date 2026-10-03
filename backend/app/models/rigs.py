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


class Device(CamelModel):
    id: str
    name: str
    type: DeviceType
    port: str
    health: Health
    calibration: Calibration
    streams: list[DeviceStream]
    stats: list[Stat]

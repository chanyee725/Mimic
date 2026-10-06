"""Rig file format (config/rigs/<id>.yaml): robot / device / cameras / rates, mapped to Rig.

A rig with a `sim: { env: <env-id> }` section is simulated: its robots and cameras live in that
Isaac Sim environment (no ports), while its leader arms are real devices on the station."""

import json
import re
from typing import Any, Iterator

import yaml
from pydantic import BaseModel, ConfigDict, Field, PositiveInt, field_validator, model_validator

from app.models.rigs import Calibration, Device, DeviceStream, Rig, RigCamera, TargetHz
from app.services.rigs.driver import Hardware

_RESOLUTION = re.compile(r"^\s*(\d+)\s*[x×]\s*(\d+)\s*$")
_SUFFIX = re.compile(r"\s*\([^)]*\)$")

# Legacy files predate hardware types; every shipped rig is SO-101
_LEGACY_TYPE = {"robot": "so101_follower", "teleop": "so101_leader"}


class _Spec(BaseModel):
    # Unknown keys load (and are reported by unknown_keys())
    model_config = ConfigDict(extra="allow")


class RobotSpec(_Spec):
    id: str
    type: str
    name: str
    port: str = ""  # none for a simulated robot
    joints: list[str] = Field(min_length=1)
    calibration_id: str | None = None  # LeRobot id (calibration file name); defaults to id


class DeviceSpec(_Spec):
    id: str
    type: str
    name: str
    port: str
    calibration_id: str | None = None


class CameraSpec(_Spec):
    key: str
    id: str | None = None  # device id; defaults to the key
    name: str
    port: str = ""  # none for a simulated camera
    resolution: str  # normalized to "640×480"
    fps: PositiveInt | None = None  # defaults to rates.video_fps
    default_on: bool = True

    @field_validator("resolution", mode="before")
    @classmethod
    def _resolution(cls, v: Any) -> str:
        m = _RESOLUTION.match(str(v))
        if not m:
            raise ValueError("resolution must look like 640x480")
        return f"{m[1]}×{m[2]}"

    @property
    def device_id(self) -> str:
        return self.id or self.key

    @property
    def size(self) -> tuple[int, int]:
        w, h = self.resolution.split("×")
        return int(w), int(h)


class Rates(_Spec):
    action_hz: PositiveInt
    video_fps: PositiveInt
    action_hz_options: list[PositiveInt] = []
    video_fps_options: list[PositiveInt] = []

    @model_validator(mode="after")
    def _options(self) -> "Rates":
        self.action_hz_options = self.action_hz_options or [self.action_hz]
        self.video_fps_options = self.video_fps_options or [self.video_fps]
        if self.action_hz not in self.action_hz_options:
            raise ValueError("rates.action_hz must be one of action_hz_options")
        if self.video_fps not in self.video_fps_options:
            raise ValueError("rates.video_fps must be one of video_fps_options")
        return self


class SimSpec(_Spec):
    env: str = Field(min_length=1)  # Isaac Sim environment id (folder under VLA_SIM_ENVS_DIR)


class RigFile(_Spec):
    id: str
    name: str
    sim: SimSpec | None = None
    robots: list[RobotSpec] = Field(min_length=1)
    devices: list[DeviceSpec] = []
    cameras: list[CameraSpec] = []
    rates: Rates

    @model_validator(mode="before")
    @classmethod
    def _shape(cls, data: Any) -> Any:
        """robot / device (one) or robots / devices maps keyed by id; cameras keyed by key."""
        if not isinstance(data, dict):
            raise ValueError("a rig file must be a mapping")
        data = dict(data)
        for one, many in (("robot", "robots"), ("device", "devices")):
            if one in data and many in data:
                raise ValueError(f"use either '{one}' or '{many}', not both")
            if one in data:
                data[many] = [data.pop(one)]
            elif isinstance(data.get(many), dict):
                data[many] = [_with(v, "id", k) for k, v in data[many].items()]
        if isinstance(data.get("cameras"), dict):
            data["cameras"] = [_with(v, "key", k) for k, v in data["cameras"].items()]
        return data

    @model_validator(mode="after")
    def _check(self) -> "RigFile":
        counts = {len(r.joints) for r in self.robots}
        if len(counts) > 1:
            raise ValueError("all robots in a rig must have the same number of joints")
        joints = self.joints
        if len(set(joints)) != len(joints):
            raise ValueError("joint names must be unique across robots")
        ids = [*(r.id for r in self.robots), *(d.id for d in self.devices)]
        ids += [c.device_id for c in self.cameras]
        if len(set(ids)) != len(ids):
            raise ValueError("device ids must be unique within a rig")
        for c in self.cameras:
            c.fps = c.fps or self.rates.video_fps
        return self

    @property
    def joints(self) -> list[str]:
        return [j for r in self.robots for j in r.joints]

    @property
    def simulated_ids(self) -> set[str]:
        """Devices that live in Isaac Sim: a sim rig's robots and cameras."""
        if self.sim is None:
            return set()
        return {*(r.id for r in self.robots), *(c.device_id for c in self.cameras)}


def _with(body: Any, field: str, value: str) -> Any:
    return {**body, field: value} if isinstance(body, dict) else body


# --- reading ----------------------------------------------------------------


def is_legacy(doc: Any) -> bool:
    """Old raw dump of Rig (master / slave keys)."""
    return isinstance(doc, dict) and ("master" in doc or "slave" in doc)


def unknown_keys(spec: RigFile) -> list[str]:
    return list(_extra(spec, ""))


def _extra(model: BaseModel, prefix: str) -> Iterator[str]:
    for key in model.model_extra or {}:
        yield f"{prefix}{key}"
    for name in type(model).model_fields:
        value = getattr(model, name)
        if isinstance(value, BaseModel):
            yield from _extra(value, f"{prefix}{name}.")
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, BaseModel):
                    tag = getattr(item, "key", None) or getattr(item, "id", None)
                    yield from _extra(item, f"{prefix}{name}.{tag}.")


def from_legacy(rig: Rig, devices: dict[str, Device]) -> RigFile:
    """Convert an old-format Rig, filling names / ports from the known devices."""
    per_robot = len(rig.joints) // max(len(rig.robots), 1)

    def device(i: str, fallback: str, kind: str) -> dict[str, str]:
        d = devices.get(i)
        return {
            "id": i,
            "type": _LEGACY_TYPE[kind],
            "name": d.name if d else fallback,
            "port": d.port if d else "",
        }

    robots = [
        device(i, rig.slave if len(rig.robots) == 1 else i, "robot")
        | {"joints": rig.joints[n * per_robot : (n + 1) * per_robot]}
        for n, i in enumerate(rig.robots)
    ]
    teleops = [device(i, rig.master if len(rig.devices) == 1 else i, "teleop") for i in rig.devices]
    cameras = []
    for c in rig.cameras:
        d = devices.get(c.id)
        cam = {
            "key": c.key,
            "name": c.name,
            "port": d.port if d else "",
            "resolution": c.resolution,
        }
        cameras.append(
            cam
            | {"fps": c.fps, "default_on": c.default_on}
            | ({"id": c.id} if c.id != c.key else {})
        )
    rates = {
        "action_hz": rig.target_hz.action,
        "video_fps": rig.target_hz.video,
        "action_hz_options": rig.action_hz_options,
        "video_fps_options": rig.video_fps_options,
    }
    return RigFile.model_validate(
        {
            "id": rig.id,
            "name": rig.name,
            "robots": robots,
            "devices": teleops,
            "cameras": cameras,
            "rates": rates,
        }
    )


# --- mapping ----------------------------------------------------------------


def label(names: list[str]) -> str:
    """One name as is; "Arm (L)" + "Arm (R)" → "Arm ×2"; otherwise joined with " + "."""
    if len(names) <= 1:
        return names[0] if names else ""
    bases = {_SUFFIX.sub("", n) for n in names}
    return f"{bases.pop()} ×{len(names)}" if len(bases) == 1 else " + ".join(names)


def to_rig(spec: RigFile) -> Rig:
    return Rig(
        id=spec.id,
        name=spec.name,
        kind="sim" if spec.sim else "real",
        env_id=spec.sim.env if spec.sim else None,
        master=label([d.name for d in spec.devices]),
        slave=label([r.name for r in spec.robots]),
        robots=[r.id for r in spec.robots],
        devices=[d.id for d in spec.devices],
        cameras=[
            RigCamera(
                id=c.device_id,
                key=c.key,
                name=c.name,
                feature=f"observation.images.{c.key}",
                resolution=c.resolution,
                fps=c.fps,
                default_on=c.default_on,
            )
            for c in spec.cameras
        ],
        joints=spec.joints,
        target_hz=TargetHz(action=spec.rates.action_hz, video=spec.rates.video_fps),
        action_hz_options=spec.rates.action_hz_options,
        video_fps_options=spec.rates.video_fps_options,
    )


def declared_devices(spec: RigFile) -> list[Device]:
    """Every device the file declares, not connected (no drivers yet): measured rates null, no stats."""
    n = len(spec.robots[0].joints)
    hz = float(spec.rates.action_hz)
    sim = spec.simulated_ids

    def dev(i: str, name: str, kind: str, port: str, stream: DeviceStream, note: str) -> Device:
        cal = Calibration(done=False, note=note)
        return Device(
            id=i,
            name=name,
            type=kind,
            port=port,
            health="off",
            calibration=cal,
            streams=[stream],
            stats=[],
            simulated=i in sim,
        )

    out = [
        dev(
            r.id,
            r.name,
            "robot",
            r.port,
            _stream("observation.state", f"[{n}]", hz, "Hz"),
            "Not connected",
        )
        for r in spec.robots
    ]
    out += [
        dev(
            d.id,
            d.name,
            "teleop",
            d.port,
            _stream("action", f"[{n}]", hz, "Hz"),
            "Not connected",
        )
        for d in spec.devices
    ]
    for c in spec.cameras:
        w, h = c.size
        stream = _stream(f"images.{c.key}", f"{h}×{w}×3", float(c.fps), "fps")
        out.append(dev(c.device_id, c.name, "camera", c.port, stream, "Not connected"))
    return out


def hardware(spec: RigFile) -> list[Hardware]:
    """Driver view of every device: LeRobot type, port, calibration id, camera mode."""
    out = [
        Hardware(
            id=r.id, kind="robot", type=r.type, port=r.port, calibration_id=r.calibration_id or r.id
        )
        for r in spec.robots
    ]
    out += [
        Hardware(
            id=d.id,
            kind="teleop",
            type=d.type,
            port=d.port,
            calibration_id=d.calibration_id or d.id,
        )
        for d in spec.devices
    ]
    for c in spec.cameras:
        w, h = c.size
        out.append(
            Hardware(
                id=c.device_id,
                kind="camera",
                type="opencv",
                port=c.port,
                width=w,
                height=h,
                fps=c.fps or 0,
            )
        )
    return out


def _stream(key: str, shape: str, hz: float, unit: str) -> DeviceStream:
    return DeviceStream(key=key, shape=shape, target_hz=hz, measured_hz=None, unit=unit)


# --- writing ----------------------------------------------------------------


def to_doc(spec: RigFile) -> dict[str, Any]:
    """Singular robot / device when there is exactly one, else maps keyed by id."""
    doc: dict[str, Any] = {"id": spec.id, "name": spec.name}
    if spec.sim:
        doc["sim"] = {"env": spec.sim.env}
    sim = spec.simulated_ids

    def port(i: str, value: str) -> dict[str, str]:
        return {} if i in sim and not value else {"port": value}

    robots = [
        {"id": r.id, "type": r.type, "name": r.name}
        | port(r.id, r.port)
        | ({"calibration_id": r.calibration_id} if r.calibration_id else {})
        | {"joints": r.joints}
        for r in spec.robots
    ]
    teleops = [
        {"id": d.id, "type": d.type, "name": d.name, "port": d.port}
        | ({"calibration_id": d.calibration_id} if d.calibration_id else {})
        for d in spec.devices
    ]
    for one, many, items in (("robot", "robots", robots), ("device", "devices", teleops)):
        if len(items) == 1:
            doc[one] = items[0]
        else:
            doc[many] = {i.pop("id"): i for i in items}
    doc["cameras"] = {
        c.key: ({"id": c.id} if c.id and c.id != c.key else {})
        | {"name": c.name}
        | port(c.device_id, c.port)
        | {
            "resolution": c.resolution.replace("×", "x"),
            "fps": c.fps,
            "default_on": c.default_on,
        }
        for c in spec.cameras
    }
    doc["rates"] = spec.rates.model_dump(
        include={"action_hz", "video_fps", "action_hz_options", "video_fps_options"}
    )
    return doc


class _Dumper(yaml.SafeDumper):
    pass


def _list(dumper: yaml.SafeDumper, data: list) -> yaml.Node:
    # Scalar lists inline ([30, 60]), like the hand-written files
    flow = all(isinstance(v, (str, int, float, bool)) for v in data)
    return dumper.represent_sequence("tag:yaml.org,2002:seq", data, flow_style=flow)


_Dumper.add_representer(list, _list)


def dumps(spec: RigFile) -> str:
    return yaml.dump(to_doc(spec), Dumper=_Dumper, sort_keys=False, allow_unicode=True, width=1000)


# --- in-place edits -----------------------------------------------------------

_PLAIN = re.compile(r"^[\w/.+@-][\w/.:+@-]*$")


def _scalar(value: str) -> str:
    # Device paths stay plain; anything else is double-quoted (JSON strings are valid YAML)
    return value if _PLAIN.match(value) else json.dumps(value)


def _child(node: yaml.Node | None, key: str) -> yaml.Node | None:
    if not isinstance(node, yaml.MappingNode):
        return None
    return next((v for k, v in node.value if k.value == key), None)


def set_port_text(text: str, device_id: str, port: str) -> str:
    """The rig file with one device's `port` value replaced; comments and layout are kept."""
    root = yaml.compose(text)
    candidates = [
        ("robot", None),
        ("device", None),
        ("robots", device_id),
        ("devices", device_id),
        ("cameras", None),
    ]
    target: yaml.Node | None = None
    for section, key in candidates:
        node = _child(root, section)
        if node is None:
            continue
        if section == "cameras":
            # Keyed by camera key; the device id is `id` or the key
            for k, body in node.value if isinstance(node, yaml.MappingNode) else []:
                own = _child(body, "id")
                if (own.value if own is not None else k.value) == device_id:
                    target = _child(body, "port")
        elif key is not None:
            target = _child(_child(node, key), "port")
        elif (own := _child(node, "id")) is not None and own.value == device_id:
            target = _child(node, "port")
        if target is not None:
            break
    if not isinstance(target, yaml.ScalarNode):
        raise ValueError(f"no port for device '{device_id}' in the rig file")
    start, end = target.start_mark.index, target.end_mark.index
    return text[:start] + _scalar(port) + text[end:]

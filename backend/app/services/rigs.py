"""Rig store in data/rigs/<id>.yaml (seeded from the mocks); devices stay in memory (live hardware)."""

import logging
import yaml
from pydantic import ValidationError

from app.core import storage
from app.core.errors import ApiError, conflict, not_found
from app.core.events import bus
from app.seeds import load
from app.models.rigs import Calibration, Device, Rig
from app.utils.time import today

log = logging.getLogger(__name__)

_rigs: dict[str, Rig] = {}
_devices: dict[str, Device] = {}

CALIBRATING = "Calibrating…"


RIGS_DIR = "rigs"


def reset() -> None:
    """Rigs come from data/rigs (seeded and written when missing); devices from the mocks."""
    _rigs.clear()
    _devices.clear()
    _rigs.update(_load_or_seed(RIGS_DIR, load("rigs", "RIGS")))
    _devices.update({d["id"]: Device.model_validate(d) for d in load("devices", "DEVICES")})


def _load_or_seed(folder: str, seed: list[dict]) -> dict[str, Rig]:
    if storage.path(folder).is_dir():
        # Seeded ids keep their mock order (the web defaults to the first rig); new files follow
        rank = {s["id"]: i for i, s in enumerate(seed)}
        loaded = _load_folder(folder)
        order = sorted(loaded, key=lambda k: rank.get(k, len(rank)))
        return {k: loaded[k] for k in order}
    items = {s["id"]: Rig.model_validate(s) for s in seed}
    for item in items.values():
        _save(folder, item)
    return items


def _load_folder(folder: str) -> dict[str, Rig]:
    """Valid files only; a broken file is logged and skipped. The id comes from the content."""
    items: dict[str, Rig] = {}
    for p in storage.list_yaml(folder):
        rel = f"{folder}/{p.name}"
        try:
            item = Rig.model_validate(storage.read(rel))
        except (storage.StorageError, ValidationError) as e:
            log.warning("Skipping %s: %s", rel, e)
            continue
        if item.id in items:
            log.warning("Skipping %s: duplicate id '%s'", rel, item.id)
            continue
        items[item.id] = item
    return items


def _save(folder: str, item: Rig) -> None:
    storage.write(f"{folder}/{item.id}.yaml", item.model_dump(by_alias=False, mode="json"))


def list_rigs() -> list[Rig]:
    return list(_rigs.values())


def get_rig(rig_id: str) -> Rig | None:
    return _rigs.get(rig_id)


def list_devices() -> list[Device]:
    return list(_devices.values())


def get_device(device_id: str) -> Device | None:
    return _devices.get(device_id)


def require_rig(rig_id: str) -> Rig:
    rig = _rigs.get(rig_id)
    if rig is None:
        raise not_found("Rig", rig_id)
    return rig


def require_device(device_id: str) -> Device:
    device = _devices.get(device_id)
    if device is None:
        raise not_found("Device", device_id)
    return device


def rig_devices(rig_id: str) -> list[Device]:
    """Robots, then other devices, then cameras."""
    rig = require_rig(rig_id)
    ids = [*rig.robots, *rig.devices, *(c.id for c in rig.cameras)]
    return [_devices[i] for i in ids if i in _devices]


def rig_yaml(rig_id: str) -> str:
    rig = require_rig(rig_id)
    doc = {
        "rig_id": rig.id,
        "name": rig.name,
        "leader": rig.master,
        "follower": rig.slave,
        "robots": [_device_yaml(i) for i in rig.robots],
        "devices": [_device_yaml(i) for i in rig.devices],
        "cameras": [
            {
                "key": c.key,
                "device": c.id,
                "name": c.name,
                "feature": c.feature,
                "resolution": c.resolution,
                "fps": c.fps,
                "default_on": c.default_on,
            }
            for c in rig.cameras
        ],
        "joints": rig.joints,
        "rates": {"action_hz": rig.target_hz.action, "video_fps": rig.target_hz.video},
        "options": {"action_hz": rig.action_hz_options, "video_fps": rig.video_fps_options},
    }
    return yaml.safe_dump(doc, sort_keys=False, allow_unicode=True, width=1000)


def _device_yaml(device_id: str) -> dict[str, str]:
    d = _devices.get(device_id)
    return {"id": device_id, "port": d.port if d else ""}


# --- calibration ------------------------------------------------------------


def start_calibration(device_id: str) -> Device:
    """Mark a device as calibrating (memory only); finish_calibration() completes and saves it."""
    device = require_device(device_id)
    if device.health == "off":
        raise ApiError(503, f"Device '{device_id}' is not connected")
    if device.calibration.note == CALIBRATING:
        raise conflict(f"Device '{device_id}' is already calibrating")
    device = device.model_copy(update={"calibration": Calibration(done=False, note=CALIBRATING)})
    _devices[device_id] = device
    bus.publish("device.updated", device)
    return device


def finish_calibration(device_id: str) -> None:
    # Mock: real calibration talks to the motors / camera
    device = _devices.get(device_id)
    if device is None or device.calibration.note != CALIBRATING:
        return
    what = "Intrinsics registered" if device.type == "camera" else "Calibrated"
    note = f"{what} · {today().isoformat()}"
    device = device.model_copy(update={"calibration": Calibration(done=True, note=note)})
    _devices[device_id] = device
    bus.publish("device.updated", device)


reset()

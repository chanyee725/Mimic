"""Rig store in data/rigs/<id>.yaml (format: file_format.py); devices are declared there.

No seeds: a missing folder means no rigs. Devices start not connected; a connection test
(driver.py, LeRobot) reports health and stats, and arms calibrate through calibration.py. The
port each device uses on this station is kept in data/ports.local.yaml (ports.py).
"""

import logging
from datetime import datetime
from typing import Any

from pydantic import ValidationError

from app.core import storage
from app.core.errors import ApiError, conflict, not_found
from app.core.events import bus
from app.models.rigs import Calibration, CalibrationSession, Device, DeviceCheck, Port, Rig, Stat
from app.services.rigs import calibration, driver, ports
from app.services.rigs import file_format as rigs_file
from app.services.rigs.driver import Hardware
from app.services.rigs.file_format import RigFile
from app.utils.time import now_iso, tz

log = logging.getLogger(__name__)

_specs: dict[str, RigFile] = {}
_rigs: dict[str, Rig] = {}
_devices: dict[str, Device] = {}
_hardware: dict[str, Hardware] = {}

CALIBRATING = "Calibrating…"


RIGS_DIR = "rigs"


def reset() -> None:
    """Rigs from data/rigs (sorted by file name); their devices start not connected."""
    calibration.reset()
    _specs.clear()
    _specs.update(_load_folder(RIGS_DIR))
    _rigs.clear()
    _rigs.update({k: rigs_file.to_rig(s) for k, s in _specs.items()})
    _devices.clear()
    _hardware.clear()
    local = ports.load_overrides()
    for spec in _specs.values():
        for d, hw in zip(rigs_file.declared_devices(spec), rigs_file.hardware(spec)):
            if d.id in _devices:
                continue  # the first rig declaring an id wins
            hw.port = local.get(d.id, hw.port)
            _hardware[d.id] = hw
            _devices[d.id] = d.model_copy(
                update={"port": hw.port, "calibration": _file_calibration(hw)}
            )


def _load_folder(folder: str) -> dict[str, RigFile]:
    """Valid files only; a broken file is logged and skipped. The id comes from the content."""
    items: dict[str, RigFile] = {}
    for p in storage.list_yaml(folder):
        rel = f"{folder}/{p.name}"
        try:
            item = _parse(rel, storage.read(rel))
        except (storage.StorageError, ValidationError) as e:
            log.warning("Skipping %s: %s", rel, e)
            continue
        if item.id in items:
            log.warning("Skipping %s: duplicate id '%s'", rel, item.id)
            continue
        items[item.id] = item
    return items


def _parse(rel: str, doc: Any) -> RigFile:
    if rigs_file.is_legacy(doc):
        # Old raw dump of Rig: convert and rewrite in the current format
        item = rigs_file.from_legacy(Rig.model_validate(doc), {})
        storage.write_text(rel, rigs_file.dumps(item))
        log.info("Migrated %s to the current rig format", rel)
        return item
    item = RigFile.model_validate(doc)
    if unknown := rigs_file.unknown_keys(item):
        log.warning("%s: unknown keys ignored: %s", rel, ", ".join(unknown))
    return item


def list_rigs() -> list[Rig]:
    return list(_rigs.values())


def get_rig(rig_id: str) -> Rig | None:
    return _rigs.get(rig_id)


def list_devices() -> list[Device]:
    return [_live(d) for d in _devices.values()]


def get_device(device_id: str) -> Device | None:
    d = _devices.get(device_id)
    return _live(d) if d else None


def _live(device: Device) -> Device:
    if calibration.active(device.id):
        return device.model_copy(update={"calibration": Calibration(done=False, note=CALIBRATING)})
    return device


def require_rig(rig_id: str) -> Rig:
    rig = _rigs.get(rig_id)
    if rig is None:
        raise not_found("Rig", rig_id)
    return rig


def require_device(device_id: str) -> Device:
    device = _devices.get(device_id)
    if device is None:
        raise not_found("Device", device_id)
    return _live(device)


def rig_devices(rig_id: str) -> list[Device]:
    """Robots, then other devices, then cameras."""
    rig = require_rig(rig_id)
    ids = [*rig.robots, *rig.devices, *(c.id for c in rig.cameras)]
    return [_live(_devices[i]) for i in ids if i in _devices]


def rig_yaml(rig_id: str) -> str:
    """The rig in its file format (as written to data/rigs, without comments)."""
    require_rig(rig_id)
    return rigs_file.dumps(_specs[rig_id])


def set_device_state(device_id: str, **live: Any) -> Device:
    """Replace live fields (health, calibration, streams, stats) of a device; tests use it to
    bring devices online without hardware."""
    require_device(device_id)
    return _update(device_id, **live)


# --- ports and connection test -----------------------------------------------


def _update(device_id: str, **fields: Any) -> Device:
    device = _devices[device_id].model_copy(update=fields)
    _devices[device_id] = device
    device = _live(device)
    bus.publish("device.updated", device)
    return device


def scan_ports() -> list[Port]:
    """Ports found now, with the devices assigned to each (by path or kernel node)."""
    found = ports.scan()
    for p in found:
        p.used_by = [i for i, hw in _hardware.items() if hw.port in (p.path, p.device)]
    return found


def set_port(device_id: str, port: str) -> Device:
    """Use `port` for the device on this station (data/ports.local.yaml); resets its test."""
    require_device(device_id)
    port = port.strip()
    if not port.startswith("/"):
        raise ApiError(400, "A port is an absolute path (/dev/…)")
    if calibration.active(device_id):
        raise conflict(f"Device '{device_id}' is calibrating")
    local = ports.load_overrides()
    local[device_id] = port
    ports.save_overrides(local)
    hw = _hardware[device_id]
    hw.port = port
    return _update(
        device_id,
        port=port,
        health="off",
        stats=[],
        check=None,
        calibration=_file_calibration(hw),
        streams=[st.model_copy(update={"measured_hz": None}) for st in _devices[device_id].streams],
    )


def test_device(device_id: str) -> Device:
    """Open the device once (LeRobot) and report what answered; a failed test is not an error."""
    require_device(device_id)
    if calibration.active(device_id):
        raise conflict(f"Device '{device_id}' is calibrating")
    hw = _hardware[device_id]
    if reason := driver.get().unavailable():
        raise ApiError(503, reason)
    if not ports.exists(hw.port):
        return _tested(device_id, False, f"Port not found: {hw.port}", "off", [])
    try:
        if hw.kind == "camera":
            return _tested_camera(device_id, hw)
        return _tested_arm(device_id, hw)
    except ApiError as e:
        if e.status != 503:
            raise
        return _tested(device_id, False, e.message, "off", [])


def _tested_arm(device_id: str, hw: Hardware) -> Device:
    r = driver.get().test_arm(hw)
    found = [m for m, ok in r.motors.items() if ok]
    missing = [m for m, ok in r.motors.items() if not ok]
    stats = [Stat(label="Motors", value=f"{len(found)}/{len(r.motors)}")]
    if r.voltage is not None:
        stats.append(Stat(label="Voltage", value=f"{r.voltage:.1f} V"))
    if r.temperature is not None:
        stats.append(Stat(label="Temperature", value=f"{r.temperature} °C"))
    if r.matches_file is not None:
        value = "Matches file" if r.matches_file else "Differs from file"
        stats.append(Stat(label="Motor calibration", value=value))
    if not found:
        return _tested(device_id, False, "No motor answered", "off", stats)
    if missing:
        return _tested(device_id, False, f"Missing motors: {', '.join(missing)}", "warn", stats)
    if r.matches_file is False:
        msg = "All motors answered; motor calibration differs from the file"
        return _tested(device_id, True, msg, "warn", stats)
    return _tested(device_id, True, "All motors answered", "ok", stats)


def _tested_camera(device_id: str, hw: Hardware) -> Device:
    r = driver.get().test_camera(hw)
    stats = [
        Stat(label="Resolution", value=f"{r.width}×{r.height}"),
        Stat(label="Frame rate", value=f"{r.fps:.1f} fps"),
    ]
    slow = hw.fps and r.fps < hw.fps * 0.9
    msg = f"Frames at {r.fps:.1f} fps" + (f" (target {hw.fps})" if slow else "")
    streams = [
        st.model_copy(update={"measured_hz": round(r.fps, 1)}) for st in _devices[device_id].streams
    ]
    return _tested(device_id, True, msg, "warn" if slow else "ok", stats, streams=streams)


def _tested(device_id: str, ok: bool, message: str, health: str, stats: list[Stat], **more: Any):
    check = DeviceCheck(ok=ok, message=message, at=now_iso())
    cal = _file_calibration(_hardware[device_id])
    return _update(device_id, health=health, stats=stats, check=check, calibration=cal, **more)


# --- calibration ------------------------------------------------------------


def _file_calibration(hw: Hardware) -> Calibration:
    """Arms: calibrated when LeRobot has a calibration file for the device's calibration id."""
    if hw.kind == "camera":
        return Calibration(done=False, note="Not required")
    path = driver.get().calibration_file(hw)
    if path is None:
        return Calibration(done=False, note="Required")
    day = datetime.fromtimestamp(path.stat().st_mtime, tz()).date().isoformat()
    return Calibration(done=True, note=f"Calibrated · {day}")


def _arm(device_id: str) -> Hardware:
    require_device(device_id)
    hw = _hardware[device_id]
    if hw.kind == "camera":
        raise ApiError(400, f"Device '{device_id}' is a camera: only arms are calibrated here")
    return hw


def start_calibration(device_id: str) -> CalibrationSession:
    """Opens the arm (torque off) and waits in the center step."""
    hw = _arm(device_id)
    if calibration.active(device_id):
        raise conflict(f"Device '{device_id}' is already calibrating")
    if not ports.exists(hw.port):
        raise ApiError(503, f"Port not found: {hw.port}")
    session = calibration.start(device_id, driver.get().open_arm(hw))
    bus.publish("device.updated", require_device(device_id))
    return session


def calibration_state(device_id: str) -> CalibrationSession:
    _arm(device_id)
    return calibration.state(device_id)


def next_calibration_step(device_id: str) -> CalibrationSession:
    _arm(device_id)
    session = calibration.advance(device_id)
    if session.step in ("done", "failed"):
        _update(device_id, calibration=_file_calibration(_hardware[device_id]))
    return session


def cancel_calibration(device_id: str) -> None:
    _arm(device_id)
    calibration.cancel(device_id)
    bus.publish("device.updated", require_device(device_id))


reset()

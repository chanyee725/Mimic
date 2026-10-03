"""Rig store in data/rigs/<id>.yaml (format: file_format.py); devices = rig files + live mock state."""

import logging
from typing import Any

from pydantic import ValidationError

from app.core import storage
from app.core.errors import ApiError, conflict, not_found
from app.core.events import bus
from app.seeds import load
from app.models.rigs import Calibration, Device, Rig
from app.services.rigs import file_format as rigs_file
from app.services.rigs.file_format import RigFile
from app.utils.time import today

log = logging.getLogger(__name__)

_specs: dict[str, RigFile] = {}
_rigs: dict[str, Rig] = {}
_devices: dict[str, Device] = {}

CALIBRATING = "Calibrating…"


RIGS_DIR = "rigs"


def reset() -> None:
    """Rigs from data/rigs (seeded when missing); devices declared there, merged with mock state."""
    seeds = {d["id"]: Device.model_validate(d) for d in load("devices", "DEVICES")}
    legacy = [Rig.model_validate(r) for r in load("rigs", "RIGS")]
    _specs.clear()
    _specs.update(_load_or_seed(RIGS_DIR, [rigs_file.from_legacy(r, seeds) for r in legacy], seeds))
    _rigs.clear()
    _rigs.update({k: rigs_file.to_rig(s) for k, s in _specs.items()})
    _devices.clear()
    _devices.update(_build_devices(list(_specs.values()), seeds))


def _build_devices(specs: list[RigFile], seeds: dict[str, Device]) -> dict[str, Device]:
    """Identity (name, type, port) from the files; health / calibration / streams / stats from the
    mocks by id, or offline defaults. The first rig declaring an id wins; unused mocks are dropped.
    """
    declared: dict[str, Device] = {}
    for spec in specs:
        for d in rigs_file.declared_devices(spec):
            declared.setdefault(d.id, d)
    order = sorted(declared, key=lambda i: list(seeds).index(i) if i in seeds else len(seeds))
    out = {}
    for i in order:
        d = declared[i]
        seed = seeds.get(i)
        out[i] = (
            seed.model_copy(update={"name": d.name, "type": d.type, "port": d.port}) if seed else d
        )
    return out


def _load_or_seed(
    folder: str, seed: list[RigFile], devices: dict[str, Device]
) -> dict[str, RigFile]:
    if storage.path(folder).is_dir():
        # Seeded ids keep their mock order (the web defaults to the first rig); new files follow
        rank = {s.id: i for i, s in enumerate(seed)}
        loaded = _load_folder(folder, devices)
        order = sorted(loaded, key=lambda k: rank.get(k, len(rank)))
        return {k: loaded[k] for k in order}
    for item in seed:
        _save(folder, item)
    return {s.id: s for s in seed}


def _load_folder(folder: str, devices: dict[str, Device]) -> dict[str, RigFile]:
    """Valid files only; a broken file is logged and skipped. The id comes from the content."""
    items: dict[str, RigFile] = {}
    for p in storage.list_yaml(folder):
        rel = f"{folder}/{p.name}"
        try:
            item = _parse(rel, storage.read(rel), devices)
        except (storage.StorageError, ValidationError) as e:
            log.warning("Skipping %s: %s", rel, e)
            continue
        if item.id in items:
            log.warning("Skipping %s: duplicate id '%s'", rel, item.id)
            continue
        items[item.id] = item
    return items


def _parse(rel: str, doc: Any, devices: dict[str, Device]) -> RigFile:
    if rigs_file.is_legacy(doc):
        # Old raw dump of Rig: convert and rewrite in the current format
        item = rigs_file.from_legacy(Rig.model_validate(doc), devices)
        storage.write_text(rel, rigs_file.dumps(item))
        log.info("Migrated %s to the current rig format", rel)
        return item
    item = RigFile.model_validate(doc)
    if unknown := rigs_file.unknown_keys(item):
        log.warning("%s: unknown keys ignored: %s", rel, ", ".join(unknown))
    return item


def _save(folder: str, item: RigFile) -> None:
    storage.write_text(f"{folder}/{item.id}.yaml", rigs_file.dumps(item))


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
    """The rig in its file format (as written to data/rigs, without comments)."""
    require_rig(rig_id)
    return rigs_file.dumps(_specs[rig_id])


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

"""Rig and device store (in memory, seeded from the web mocks)."""

from app.core.seed import load
from app.rigs.schemas import Device, Rig

_rigs: dict[str, Rig] = {}
_devices: dict[str, Device] = {}


def reset() -> None:
    _rigs.clear()
    _devices.clear()
    _rigs.update({r["id"]: Rig.model_validate(r) for r in load("rigs", "RIGS")})
    _devices.update({d["id"]: Device.model_validate(d) for d in load("devices", "DEVICES")})


def list_rigs() -> list[Rig]:
    return list(_rigs.values())


def get_rig(rig_id: str) -> Rig | None:
    return _rigs.get(rig_id)


def list_devices() -> list[Device]:
    return list(_devices.values())


def get_device(device_id: str) -> Device | None:
    return _devices.get(device_id)


reset()

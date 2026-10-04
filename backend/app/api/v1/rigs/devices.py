"""Devices: list, detail, ports, connection test and calibration."""

from fastapi import APIRouter, Response

from app.models.rigs import CalibrationSession, Device, Port
from app.schemas.rigs import PortUpdate
from app.services import rigs as service

router = APIRouter()


@router.get("/devices", response_model=list[Device])
def list_devices():
    return service.list_devices()


# Before /devices/{device_id}
@router.get("/devices/ports", response_model=list[Port])
def scan_ports():
    return service.scan_ports()


@router.get("/devices/{device_id}", response_model=Device)
def get_device(device_id: str):
    return service.require_device(device_id)


@router.put("/devices/{device_id}/port", response_model=Device)
def set_port(device_id: str, body: PortUpdate):
    return service.set_port(device_id, body.port)


# Sync handlers run in the thread pool: the test blocks for about a second
@router.post("/devices/{device_id}/test", response_model=Device)
def test_device(device_id: str):
    return service.test_device(device_id)


@router.post("/devices/{device_id}/calibrate", response_model=CalibrationSession, status_code=201)
def calibrate_device(device_id: str):
    return service.start_calibration(device_id)


@router.get("/devices/{device_id}/calibration", response_model=CalibrationSession)
def calibration_state(device_id: str):
    return service.calibration_state(device_id)


@router.post("/devices/{device_id}/calibration/next", response_model=CalibrationSession)
def next_calibration_step(device_id: str):
    return service.next_calibration_step(device_id)


@router.delete("/devices/{device_id}/calibration", status_code=204)
def cancel_calibration(device_id: str):
    service.cancel_calibration(device_id)
    return Response(status_code=204)

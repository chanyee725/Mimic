"""Devices: list, detail and calibration."""

from fastapi import APIRouter, BackgroundTasks

from app.models.rigs import Device
from app.services import rigs as service

router = APIRouter()


@router.get("/devices", response_model=list[Device])
def list_devices():
    return service.list_devices()


@router.get("/devices/{device_id}", response_model=Device)
def get_device(device_id: str):
    return service.require_device(device_id)


@router.post("/devices/{device_id}/calibrate", response_model=Device, status_code=202)
def calibrate_device(device_id: str, background: BackgroundTasks):
    device = service.start_calibration(device_id)
    background.add_task(service.finish_calibration, device_id)
    return device

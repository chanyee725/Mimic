"""Rigs endpoints — see docs/api/rigs.md."""

from fastapi import APIRouter, BackgroundTasks, Response

from app.rigs import service
from app.rigs.schemas import Device, Rig

router = APIRouter(prefix="", tags=["rigs"])

YAML = "text/yaml"


@router.get("/rigs", response_model=list[Rig])
def list_rigs():
    return service.list_rigs()


@router.get("/rigs/{rig_id}", response_model=Rig)
def get_rig(rig_id: str):
    return service.require_rig(rig_id)


@router.get(
    "/rigs/{rig_id}/yaml", response_class=Response, responses={200: {"content": {YAML: {}}}}
)
def rig_yaml(rig_id: str):
    return Response(service.rig_yaml(rig_id), media_type=YAML)


@router.get("/rigs/{rig_id}/devices", response_model=list[Device])
def rig_devices(rig_id: str):
    return service.rig_devices(rig_id)


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

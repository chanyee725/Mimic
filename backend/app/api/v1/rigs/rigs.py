"""Rigs: list, detail, YAML and attached devices."""

from fastapi import APIRouter, Response

from app.models.rigs import Device, Rig, TeleopSamples, TeleopState
from app.services import rigs as service

router = APIRouter()

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


# Sync: runs in the thread pool (a few seconds with cameras)
@router.post("/rigs/{rig_id}/test", response_model=list[Device])
def test_rig(rig_id: str):
    return service.test_rig(rig_id)


@router.post("/rigs/{rig_id}/teleop", response_model=TeleopState, status_code=201)
def start_teleop(rig_id: str):
    return service.start_teleop(rig_id)


@router.get("/rigs/{rig_id}/teleop/samples", response_model=TeleopSamples)
def teleop_samples(rig_id: str, after: int = -1):
    return service.teleop_samples(rig_id, after)


# 200 null when there is no session: the web polls this while teleop is off
@router.get("/rigs/{rig_id}/teleop", response_model=TeleopState | None)
def teleop_state(rig_id: str):
    return service.teleop_state(rig_id)


@router.delete("/rigs/{rig_id}/teleop", status_code=204)
def stop_teleop(rig_id: str):
    service.stop_teleop(rig_id)
    return Response(status_code=204)

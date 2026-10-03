"""Rigs: list, detail, YAML and attached devices."""

from fastapi import APIRouter, Response

from app.models.rigs import Device, Rig
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

"""Isaac Sim teleoperation: a leader arm drives the robot opened alone in Isaac Sim."""

from fastapi import APIRouter, Response

from app.models.simulation import SimAsset, SimTeleop
from app.schemas.simulation import LeaderRestCapture, SimJog, SimTeleopStart
from app.services import simulation as service

router = APIRouter()


@router.post("/teleop", response_model=SimTeleop, status_code=201)
def start_teleop(body: SimTeleopStart):
    return service.teleop.start(body.robot_id, body.device_id, body.display, body.kind)


@router.get("/teleop", response_model=SimTeleop | None)
def teleop_state():
    return service.teleop.state()


@router.put("/teleop/jog", status_code=204)
def jog(body: SimJog):
    service.teleop.set_jog(body.velocities, body.twist)
    return Response(status_code=204)


@router.delete("/teleop", status_code=204)
def stop_teleop():
    service.teleop.stop()
    return Response(status_code=204)


@router.post("/robots/{robot_id}/leader-rest", response_model=SimAsset)
def capture_leader_rest(robot_id: str, body: LeaderRestCapture):
    return service.teleop.capture_leader_rest(robot_id, body.device_id)

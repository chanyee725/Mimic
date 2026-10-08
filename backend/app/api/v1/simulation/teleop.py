"""Isaac Sim teleoperation: a leader arm drives the robot opened alone in Isaac Sim."""

from fastapi import APIRouter, Response

from app.models.simulation import SimAsset, SimTeleop
from app.schemas.simulation import InitialPoseCapture, SimTeleopStart
from app.services import simulation as service

router = APIRouter()


@router.post("/teleop", response_model=SimTeleop, status_code=201)
def start_teleop(body: SimTeleopStart):
    return service.teleop.start(body.robot_id, body.device_id, body.display)


@router.get("/teleop", response_model=SimTeleop | None)
def teleop_state():
    return service.teleop.state()


@router.delete("/teleop", status_code=204)
def stop_teleop():
    service.teleop.stop()
    return Response(status_code=204)


@router.post("/robots/{robot_id}/initial-pose", response_model=SimAsset)
def capture_initial_pose(robot_id: str, body: InitialPoseCapture):
    return service.teleop.capture_initial_pose(robot_id, body.device_id)

"""Isaac Sim server: status, start / stop the app, open an environment, a robot or a tool."""

from fastapi import APIRouter

from app.models.simulation import SimRunner
from app.schemas.simulation import RunnerStart
from app.services import simulation as service

router = APIRouter()


@router.get("/runner", response_model=SimRunner)
def runner_status():
    return service.runner.status()


@router.post("/runner/start", response_model=SimRunner)
def runner_start(body: RunnerStart | None = None):
    return service.runner.start(body.display if body else None)


@router.post("/runner/stop", response_model=SimRunner)
def runner_stop():
    return service.runner.stop()


@router.post("/envs/{env_id}/open", response_model=SimRunner)
def open_env(env_id: str, body: RunnerStart | None = None):
    return service.runner.open_env(env_id, body.display if body else None)


@router.post("/robots/{robot_id}/open", response_model=SimRunner)
def open_robot(robot_id: str, body: RunnerStart | None = None):
    return service.runner.open_asset("robot", robot_id, body.display if body else None)


@router.post("/tools/{tool_id}/open", response_model=SimRunner)
def open_tool(tool_id: str, body: RunnerStart | None = None):
    return service.runner.open_asset("tool", tool_id, body.display if body else None)

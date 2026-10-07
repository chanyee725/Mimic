"""Capture session control: start, subtask marks, stop, save / rerecord / discard."""

from fastapi import APIRouter

from app.models.capture import CaptureState
from app.models.recordings import Recording
from app.schemas.capture import SaveBody, StartBody, SubtaskBody
from app.services import capture as service

router = APIRouter()


@router.get("/state", response_model=CaptureState)
def get_state():
    return service.state()


@router.post("/start", response_model=CaptureState)
def start(body: StartBody):
    return service.start(body.task_id)


@router.post("/subtask", response_model=CaptureState)
def subtask(body: SubtaskBody):
    return service.mark_subtask(body.index)


@router.post("/stop", response_model=CaptureState)
def stop():
    return service.stop()


@router.post("/save", status_code=201, response_model=Recording)
def save(body: SaveBody):
    return service.save(body.outcome)


@router.post("/rerecord", response_model=CaptureState)
def rerecord():
    return service.rerecord()


@router.post("/discard", response_model=CaptureState)
def discard():
    return service.discard()

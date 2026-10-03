"""Station endpoints — see docs/api/station.md."""

from typing import Annotated

from fastapi import APIRouter, Query

from app.services import station as service
from app.models.station import DataTotal, Station
from app.schemas.station import CurrentTask, DayCount

router = APIRouter(prefix="/station", tags=["station"])


@router.get("", response_model=Station)
def get_station():
    return service.get_station()


@router.get("/totals", response_model=list[DataTotal])
def totals():
    return service.totals()


@router.get("/activity", response_model=list[DayCount])
def activity(weeks: Annotated[int, Query(ge=1, le=104)] = 52):
    return service.activity(weeks)


@router.get("/warnings", response_model=list[str])
def warnings():
    return service.warnings()


@router.get("/current-task", response_model=CurrentTask)
def current_task():
    return service.current_task()


@router.put("/current-task", response_model=CurrentTask)
def set_current_task(body: CurrentTask):
    return service.set_current_task(body.task_id)

"""Real-robot evaluation runs: start, stop, judge."""

from fastapi import APIRouter, Query

from app.models.evaluate import EvalRun
from app.schemas.evaluate import EvalResult, EvalRunCreate
from app.services import evaluate as service

router = APIRouter()


@router.get("/runs", response_model=list[EvalRun])
def list_runs(model_id: str | None = Query(None, alias="modelId")):
    return service.list_runs(model_id)


@router.post("/runs", response_model=EvalRun, status_code=201)
def start_run(body: EvalRunCreate):
    return service.start(body)


@router.get("/runs/{run_id}", response_model=EvalRun)
def get_run(run_id: str):
    return service.get_run(run_id)


@router.post("/runs/{run_id}/stop", response_model=EvalRun)
def stop_run(run_id: str):
    return service.stop(run_id)


@router.post("/runs/{run_id}/result", response_model=EvalRun)
def judge_run(run_id: str, body: EvalResult):
    return service.judge(run_id, body.result)

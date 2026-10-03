"""Real-robot evaluation runs of the current session (in memory, no mocks).

State machine: running → judging (stop, or automatically at limitS) → done (verdict).
Starting a run needs the robot, which is not connected yet (503).
"""

from app.core.errors import ApiError, conflict, not_found
from app.core.events import bus
from app.models.evaluate import EvalRun
from app.schemas.evaluate import EvalRunCreate
from app.services import capture, models
from app.utils.time import now_iso, parse_iso, seconds_since

NOT_CONNECTED = "Robot is not connected"

_runs: dict[str, EvalRun] = {}
_session_start = ""


def reset() -> None:
    global _session_start
    _runs.clear()
    _session_start = now_iso()


def _tick(run: EvalRun) -> EvalRun:
    """Updates elapsed time; a running run past its limit moves to judging."""
    if run.state != "running":
        return run
    elapsed = seconds_since(parse_iso(run.started_at))
    if elapsed >= run.limit_s:
        run.state, run.elapsed_s = "judging", run.limit_s
        bus.publish("evaluate.run", run)
    else:
        run.elapsed_s = round(elapsed, 1)
    return run


def list_runs(model_id: str | None = None) -> list[EvalRun]:
    return [_tick(r) for r in _runs.values() if model_id is None or r.model_id == model_id]


def get_run(run_id: str) -> EvalRun:
    run = _runs.get(run_id)
    if run is None:
        raise not_found("Eval run", run_id)
    return _tick(run)


def _active() -> EvalRun | None:
    return next((r for r in list_runs() if r.state != "done"), None)


def _capture_active() -> bool:
    return capture.is_active()


def start(body: EvalRunCreate) -> EvalRun:
    """Validates the request; refused with 503 until the robot is connected."""
    if models.get_model(body.model_id) is None:
        raise not_found("Model", body.model_id)
    instruction = body.instruction.strip()
    if not instruction:
        raise ApiError(
            422,
            "Instruction is empty",
            {"errors": [{"loc": ["body", "instruction"], "msg": "Instruction is empty"}]},
        )
    if active := _active():
        raise conflict("Another evaluation run is active", runId=active.id)
    if _capture_active():
        raise conflict("A capture is active")
    # Policy rollout on the robot is not wired up yet
    raise ApiError(503, NOT_CONNECTED, {"modelId": body.model_id})


def stop(run_id: str) -> EvalRun:
    run = get_run(run_id)
    if run.state != "running":
        raise conflict(f"Run '{run_id}' is not running", state=run.state)
    run.state = "judging"
    bus.publish("evaluate.run", run)
    return run


def judge(run_id: str, result: str) -> EvalRun:
    run = get_run(run_id)
    if run.state != "judging":
        raise conflict(f"Run '{run_id}' is not waiting for a verdict", state=run.state)
    run.state = "done"
    if result != "discard":
        run.result = result  # type: ignore[assignment]
        models.record_trial(run.model_id, run.instruction, result == "success", _session_start)
    bus.publish("evaluate.run", run)
    return run


reset()

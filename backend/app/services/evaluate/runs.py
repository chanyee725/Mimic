"""Real-robot evaluation runs of the current session (in memory).

State machine: loading (policy onto the GPU, robot connected) → running (the policy drives the
follower) → judging (Stop, the time limit or an error; the arm holds its pose with torque on)
→ done (verdict; the robot is released, so its torque drops).
"""

import logging
import threading
import time
from collections import deque
from dataclasses import dataclass, field

from app.core.errors import ApiError, conflict, not_found
from app.core.events import bus
from app.models.evaluate import EvalRun
from app.models.rigs import TeleopSamples
from app.schemas.evaluate import EvalRunCreate
from app.services import capture, datasets, models, rigs, tasks
from app.services.evaluate import policy as policies
from app.services.rigs.driver import RobotLink
from app.utils.ids import next_seq_id
from app.utils.time import now_iso

log = logging.getLogger(__name__)

# Safety: the most a joint may move towards the policy's target in one control step (degrees;
# the gripper's 0–100 range too). A wild action is followed slowly instead of in one jump.
MAX_STEP = 4.0
DEFAULT_HZ = 30  # control rate when the model's dataset fps is unknown
FRAME_TIMEOUT_S = 1.0  # a camera silent this long ends the run
BUFFER_S = 120
LIVE_WINDOW_S = 10.0
RECORD_UNAVAILABLE = "Recording trials is not available yet"


@dataclass
class _Sample:
    seq: int
    t: float
    action: list[float]
    state: list[float]


@dataclass
class _Rollout:
    run: EvalRun
    robot: RobotLink
    cameras: dict  # key → rigs camera Recorder
    hz: int
    task_text: str
    joints: list[str]
    stop: threading.Event = field(default_factory=threading.Event)
    samples: deque = field(default_factory=lambda: deque(maxlen=BUFFER_S * 60))
    seq: int = -1
    thread: threading.Thread | None = None
    released: bool = False


_runs: dict[str, EvalRun] = {}
_rollouts: dict[str, _Rollout] = {}
_lock = threading.RLock()
_session_start = ""


def reset() -> None:
    global _session_start
    with _lock:
        for ro in list(_rollouts.values()):
            ro.stop.set()
            if ro.thread is not None:
                ro.thread.join(timeout=5)
            _release(ro)
        _rollouts.clear()
        _runs.clear()
    _session_start = now_iso()


def list_runs(model_id: str | None = None) -> list[EvalRun]:
    return [r for r in list(_runs.values()) if model_id is None or r.model_id == model_id]


def get_run(run_id: str) -> EvalRun:
    run = _runs.get(run_id)
    if run is None:
        raise not_found("Eval run", run_id)
    return run


def _active() -> EvalRun | None:
    return next((r for r in list_runs() if r.state != "done"), None)


def _publish(run: EvalRun) -> None:
    bus.publish("evaluate.run", run)


def start(body: EvalRunCreate) -> EvalRun:
    """Connects the model's rig (follower + cameras) and starts loading the policy."""
    model = models.get_model(body.model_id)
    if model is None:
        raise not_found("Model", body.model_id)
    instruction = body.instruction.strip()
    if not instruction:
        raise ApiError(
            422,
            "Instruction is empty",
            {"errors": [{"loc": ["body", "instruction"], "msg": "Instruction is empty"}]},
        )
    if body.record:
        raise ApiError(
            422, RECORD_UNAVAILABLE, {"errors": [{"loc": ["body", "record"], "msg": "Not yet"}]}
        )
    if active := _active():
        raise conflict("Another evaluation run is active", runId=active.id)
    if capture.is_active():
        raise conflict("A capture is active")
    path = models.folder(model.id) / "pretrained_model"
    if not path.is_dir():
        raise ApiError(410, "Model files are gone", {"path": str(path)})
    task = tasks.get_task(model.task_id)
    if task is None:
        raise ApiError(409, f"The model's task '{model.task_id}' does not exist")
    ds = datasets.get_dataset(model.dataset)
    hz = ds.fps if ds else DEFAULT_HZ

    robot, _ = rigs.open_robot(task.rig_id)
    try:
        cams = rigs.watch_cameras(task.rig_id)
    except BaseException:
        robot.close()
        raise
    with _lock:
        run = EvalRun(
            id=next_seq_id("run", _runs),
            model_id=model.id,
            instruction=instruction,
            limit_s=body.limit_s,
            record=False,
            state="loading",
            started_at=now_iso(),
            elapsed_s=0,
        )
        ro = _Rollout(run, robot, cams, hz, instruction, list(robot.joints))
        _runs[run.id], _rollouts[run.id] = run, ro
        ro.thread = threading.Thread(
            target=_main, args=(ro, model.id, path), name=f"eval:{run.id}", daemon=True
        )
        ro.thread.start()
    _publish(run)
    return run


def stop(run_id: str) -> EvalRun:
    """Stops sending actions (the arm holds where it is) and asks for a verdict."""
    run = get_run(run_id)
    if run.state not in ("loading", "running"):
        raise conflict(f"Run '{run_id}' is not running", state=run.state)
    ro = _rollouts.get(run_id)
    if ro is not None:
        ro.stop.set()
        if ro.thread is not None and ro.thread is not threading.current_thread():
            ro.thread.join(timeout=5)
    if run.state != "judging":
        run.state = "judging"
        _publish(run)
    return run


def judge(run_id: str, result: str) -> EvalRun:
    run = get_run(run_id)
    if run.state != "judging":
        raise conflict(f"Run '{run_id}' is not waiting for a verdict", state=run.state)
    run.state = "done"
    if result != "discard" and run.error is None:
        run.result = result  # type: ignore[assignment]
        models.record_trial(run.model_id, run.instruction, result == "success", _session_start)
    ro = _rollouts.pop(run_id, None)
    if ro is not None:
        _release(ro)
    _publish(run)
    return run


def samples(run_id: str, after: int = -1) -> TeleopSamples:
    """Policy action (sent, after the safety limit) and follower state since `after`."""
    get_run(run_id)
    ro = _rollouts.get(run_id)
    if ro is None:
        return TeleopSamples(joints=[], seq=after, t=[], action=[], state=[])
    rows = list(ro.samples)
    if rows:
        newest = rows[-1].t
        rows = [r for r in rows if r.seq > after and r.t >= newest - LIVE_WINDOW_S]
    return TeleopSamples(
        joints=ro.joints,
        seq=rows[-1].seq if rows else after,
        t=[round(r.t, 4) for r in rows],
        action=[[round(v, 3) for v in r.action] for r in rows],
        state=[[round(v, 3) for v in r.state] for r in rows],
    )


# Rollout


def _release(ro: _Rollout) -> None:
    if ro.released:
        return
    ro.released = True
    for cam in ro.cameras.values():
        try:
            cam.close()
        except Exception:
            pass
    try:
        ro.robot.close()
    except Exception:
        log.exception("Releasing the robot of %s failed", ro.run.id)


def _main(ro: _Rollout, model_id: str, path) -> None:
    run = ro.run
    try:
        policy = policies.load(model_id, path)
        policy.reset()
        if ro.stop.is_set():
            return
        run.state = "running"
        _publish(run)
        _loop(ro, policy)
    except Exception as e:
        log.exception("Evaluation run %s failed", run.id)
        run.error = str(e) or type(e).__name__
    finally:
        if run.state in ("loading", "running"):
            run.state = "judging"
            _publish(run)


def _frames(ro: _Rollout) -> dict[str, bytes]:
    """The latest frame of every camera; raises when one has been silent too long."""
    out = {}
    now = time.time()
    for key, cam in ro.cameras.items():
        frames = cam.frames
        if not frames or now - frames[-1][0] > FRAME_TIMEOUT_S:
            raise RuntimeError(f"Camera '{key}' stopped sending frames")
        out[key] = frames[-1][1]
    return out


def _limit(target: list[float], present: list[float]) -> list[float]:
    """Each joint moves at most MAX_STEP towards its target per step."""
    return [p + max(-MAX_STEP, min(MAX_STEP, t - p)) for t, p in zip(target, present)]


def _loop(ro: _Rollout, policy: policies.Policy) -> None:
    run, period = ro.run, 1 / ro.hz
    t0 = time.perf_counter()
    next_t = t0
    # Cameras may need a moment for their first frame
    deadline = time.time() + FRAME_TIMEOUT_S * 3
    while ro.cameras and any(not c.frames for c in ro.cameras.values()):
        if time.time() > deadline or ro.stop.is_set():
            break
        time.sleep(0.02)
    while not ro.stop.is_set():
        elapsed = time.perf_counter() - t0
        run.elapsed_s = round(min(elapsed, run.limit_s), 1)
        if elapsed >= run.limit_s:
            return
        pose = ro.robot.read()
        present = [pose.get(j, 0.0) for j in ro.joints]
        target = policy.act(_frames(ro), present, ro.task_text)
        if len(target) != len(present):
            raise RuntimeError(f"Policy gave {len(target)} actions for {len(present)} joints")
        sent = _limit(target, present)
        ro.robot.send(dict(zip(ro.joints, sent)))
        ro.seq += 1
        ro.samples.append(_Sample(ro.seq, elapsed, sent, present))
        next_t += period
        delay = next_t - time.perf_counter()
        if delay > 0:
            ro.stop.wait(delay)
        else:
            next_t = time.perf_counter()  # inference ran long: don't burst to catch up

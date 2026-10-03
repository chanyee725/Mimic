"""Environment registry: folders scanned from the environments dir and model compatibility."""

import threading

from app.configs.config import config
from app.core.errors import not_found
from app.core.events import bus
from app.models.models import Model
from app.models.simulation import SimEnv
from app.schemas.simulation import CompatIssue, ModelCompat, RescanResult
from app.services.models import list_models
from app.services.rigs import get_rig
from app.services.simulation.scanner import scan_envs
from app.services.tasks import get_task
from app.utils.time import now_iso

# Shared with jobs.py: env scans and job changes never interleave
lock = threading.RLock()
_first_seen: dict[str, str] = {}
_envs: dict[str, SimEnv] = {}


def reset() -> None:
    with lock:
        _first_seen.clear()
        _scan()


def _scan() -> list[SimEnv]:
    envs = scan_envs(config.sim_envs_dir, _first_seen)
    for e in envs:
        _first_seen.setdefault(e.id, e.registered_at)
    _envs.clear()
    _envs.update({e.id: e for e in envs})
    return envs


def list_envs(state: str | None = None) -> list[SimEnv]:
    return [e for e in _envs.values() if state is None or e.state == state]


def find_env(env_id: str) -> SimEnv | None:
    return _envs.get(env_id)


def get_env(env_id: str) -> SimEnv:
    env = _envs.get(env_id)
    if env is None:
        raise not_found("Environment", env_id)
    return env


def rescan() -> RescanResult:
    with lock:
        envs = _scan()
    bus.publish("sim.envs", {"envs": [e.model_dump(by_alias=True, mode="json") for e in envs]})
    return RescanResult(dir=str(config.sim_envs_dir), scanned_at=now_iso(), envs=envs)


def model_spec(model: Model) -> tuple[list[str], int]:
    """Cameras and action size a model expects, from its task and rig."""
    task = get_task(model.task_id)
    rig = get_rig(task.rig_id) if task else None
    return (list(task.cameras) if task else []), (len(rig.joints) if rig else 0)


def env_compat(env: SimEnv, cameras: list[str], action_dim: int) -> list[CompatIssue]:
    """Same rules as web/src/domain/simulation.ts#envCompat."""
    issues: list[CompatIssue] = []
    if env.state != "ready":
        issues.append(CompatIssue(level="error", text=env.error or "Environment failed to load"))
    missing = [c for c in cameras if c not in env.cameras]
    if missing:
        issues.append(CompatIssue(level="error", text=f"Missing camera {', '.join(missing)}"))
    if env.action_dim != action_dim:
        text = f"Action size {env.action_dim}, model expects {action_dim}"
        issues.append(CompatIssue(level="error", text=text))
    if not env.calibrated:
        issues.append(CompatIssue(level="warn", text="Not matched to the real rig"))
    return issues


def model_compat(env: SimEnv, model: Model) -> ModelCompat:
    issues = env_compat(env, *model_spec(model))
    usable = not any(i.level == "error" for i in issues)
    return ModelCompat(model_id=model.id, usable=usable, issues=issues)


def compat(env_id: str) -> list[ModelCompat]:
    """Every saved model: usable for the env's task first, other usable ones, then blocked."""
    env = get_env(env_id)
    models = {m.id: m for m in list_models()}
    rows = [model_compat(env, m) for m in models.values()]
    rank = lambda c: 2 if not c.usable else 0 if models[c.model_id].task_id == env.task_id else 1
    return sorted(rows, key=rank)

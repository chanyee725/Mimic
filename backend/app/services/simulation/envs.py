"""Environment registry: USD stages copied into the environments dir by hand; scan and delete."""

import shutil
import threading
from pathlib import Path

from app.configs.config import config
from app.core.errors import conflict, not_found
from app.core.events import bus
from app.models.simulation import SimEnv
from app.schemas.simulation import RescanResult
from app.services.rigs import list_rigs
from app.services.simulation.scanner import IMAGE_TYPES, scan_envs, thumbnail_file
from app.services.tasks import list_tasks
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
    envs = scan_envs(config.sim_envs_dir, _first_seen, {r.id for r in list_rigs()})
    for e in envs:
        _first_seen.setdefault(e.id, e.registered_at)
    _envs.clear()
    _envs.update({e.id: e for e in envs})
    return envs


def _publish(envs: list[SimEnv]) -> None:
    bus.publish("sim.envs", {"envs": [e.model_dump(by_alias=True, mode="json") for e in envs]})


def list_envs() -> list[SimEnv]:
    return list(_envs.values())


def find_env(env_id: str) -> SimEnv | None:
    return _envs.get(env_id)


def get_env(env_id: str) -> SimEnv:
    env = _envs.get(env_id)
    if env is None:
        raise not_found("Environment", env_id)
    return env


def thumbnail(env_id: str) -> tuple[Path, str]:
    """The env's image and its media type; 404 when it has none."""
    path = thumbnail_file(Path(get_env(env_id).path))
    if path is None:
        raise not_found("Thumbnail", env_id)
    return path, IMAGE_TYPES[path.suffix.lower()]


def rig_problem(env: SimEnv, rig_id: str | None) -> str | None:
    """An env under a rig folder only fits that rig."""
    if env.rig_id is not None and env.rig_id != rig_id:
        return f"environment '{env.id}' belongs to rig '{env.rig_id}'"
    return None


def rescan() -> RescanResult:
    with lock:
        envs = _scan()
    _publish(envs)
    return RescanResult(dir=str(config.sim_envs_dir), scanned_at=now_iso(), envs=envs)


def delete_env(env_id: str) -> None:
    """Deletes the stage file or folder; refused while a task uses the environment."""
    with lock:
        env = get_env(env_id)
        users = [t.id for t in list_tasks() if t.env_id == env_id]
        if users:
            raise conflict(f"Environment '{env_id}' is used by tasks", tasks=users)
        path = Path(env.path)
        if path.is_dir():
            shutil.rmtree(path)
        else:
            path.unlink(missing_ok=True)
        envs = _scan()
    _publish(envs)

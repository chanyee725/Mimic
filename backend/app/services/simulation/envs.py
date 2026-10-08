"""Environment registry: Python scripts copied into the environments dir by hand; scan, robot tags
(<sim folder>/envs.yaml, edited from the web) and delete."""

import shutil
import threading
from pathlib import Path

from app.configs.config import config
from app.core import storage
from app.core.errors import ApiError, conflict, not_found
from app.core.events import bus
from app.models.simulation import SimAsset, SimEnv
from app.schemas.simulation import RescanResult
from app.services.rigs import list_rigs, robot_types
from app.services.simulation.scanner import (
    IMAGE_TYPES,
    robot_file,
    scan_envs,
    scan_robots,
    thumbnail_file,
)
from app.services.tasks import list_tasks
from app.utils.time import now_iso

# Shared with jobs.py: env scans and job changes never interleave
lock = threading.RLock()
_first_seen: dict[str, str] = {}
_envs: dict[str, SimEnv] = {}


def _tags_path() -> Path:
    return config.sim_dir / "envs.yaml"


def _read_tags() -> dict[str, dict]:
    """envs.yaml: {<env id>: {robots: [<robot id>, …]}}."""
    doc = storage.read_file(_tags_path())
    return doc if isinstance(doc, dict) else {}


def _write_tags(tags: dict[str, dict]) -> None:
    storage.write_file(_tags_path(), storage.dumps(dict(sorted(tags.items()))))


def fits(robots: list[str], rig_id: str) -> bool:
    """Untagged fits any rig; else every follower of the rig must be a tagged robot."""
    types = robot_types(rig_id)
    return not robots or (bool(types) and all(t in robots for t in types))


def reset() -> None:
    with lock:
        _first_seen.clear()
        _scan()


def _scan() -> list[SimEnv]:
    tags = _read_tags()
    rig_ids = [r.id for r in list_rigs()]
    envs = []
    for e in scan_envs(config.sim_envs_dir, _first_seen):
        robots = [str(r) for r in (tags.get(e.id) or {}).get("robots") or []]
        envs.append(
            e.model_copy(
                update={"robots": robots, "rig_ids": [r for r in rig_ids if fits(robots, r)]}
            )
        )
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


def leader_types(robot_id: str) -> list[str]:
    """Leader types that can drive a robot: X_leader for a robot named X_follower."""
    if not robot_id.endswith("_follower"):
        return []
    return [robot_id.removesuffix("_follower") + "_leader"]


def robot_config(usd: Path) -> Path:
    """A robot's config next to its USD (same rule as sim/runner/scene.py): <id>/robot.yaml for a
    folder robot, else <id>.yaml."""
    return usd.parent / "robot.yaml" if usd.parent.name == usd.stem else usd.with_suffix(".yaml")


def _initial_pose(usd: Path) -> dict[str, float] | None:
    doc = storage.read_file(robot_config(usd)) or {}
    pose = doc.get("initial_pose") if isinstance(doc, dict) else None
    return {str(k): float(v) for k, v in pose.items()} if isinstance(pose, dict) else None


def list_robots() -> list[SimAsset]:
    return [
        r.model_copy(
            update={"teleop": leader_types(r.id), "initial_pose": _initial_pose(Path(r.path))}
        )
        for r in scan_robots(config.sim_robots_dir)
    ]


def get_robot(robot_id: str) -> SimAsset:
    robot = next((r for r in list_robots() if r.id == robot_id), None)
    if robot is None:
        raise not_found("Robot", robot_id)
    return robot


CONFIG_HEADER = (
    "# Robot config, read by sim/runner/scene.py when the robot is placed.\n"
    "# initial_pose: joint → degrees the robot starts and holds in when Play starts;\n"
    "# joints under percent take 0–100 over their limits (a LeRobot gripper).\n"
)


def set_initial_pose(
    robot_id: str, pose: dict[str, float], percent: list[str], source: str
) -> SimAsset:
    """Writes the robot's initial pose into its config, keeping the config's other keys."""
    usd = robot_path(robot_id)
    if usd is None:
        raise not_found("Robot", robot_id)
    path = robot_config(usd)
    doc = storage.read_file(path)
    doc = doc if isinstance(doc, dict) else {}
    doc.update(
        initial_pose={k: round(v, 2) for k, v in pose.items()},
        percent=percent,
        captured_from=source,
        captured_at=now_iso(),
    )
    storage.write_file(path, CONFIG_HEADER + storage.dumps(doc))
    return get_robot(robot_id)


def robot_path(robot_id: str) -> Path | None:
    return robot_file(config.sim_robots_dir, robot_id)


def list_tools() -> list[SimAsset]:
    """End effectors (robot hands, grippers) under the tools folder."""
    return scan_robots(config.sim_tools_dir)


def tool_path(tool_id: str) -> Path | None:
    return robot_file(config.sim_tools_dir, tool_id)


def thumbnail(env_id: str) -> tuple[Path, str]:
    """The env's image and its media type; 404 when it has none."""
    path = thumbnail_file(Path(get_env(env_id).path))
    if path is None:
        raise not_found("Thumbnail", env_id)
    return path, IMAGE_TYPES[path.suffix.lower()]


def rig_problem(env: SimEnv, rig_id: str | None) -> str | None:
    """A tagged env only fits rigs whose followers are among its robots."""
    if rig_id is None or not env.robots or rig_id in env.rig_ids:
        return None
    return f"environment '{env.id}' is for {', '.join(env.robots)}, not rig '{rig_id}'"


def set_robots(env_id: str, robots: list[str]) -> SimEnv:
    """Replaces the env's robot tags; each must be a robot under the robots folder."""
    with lock:
        get_env(env_id)
        known = {r.id for r in list_robots()}
        if unknown := [r for r in robots if r not in known]:
            raise ApiError(422, f"Unknown robot: {', '.join(unknown)}", {"robots": unknown})
        tags = _read_tags()
        if robots:
            tags[env_id] = {**(tags.get(env_id) or {}), "robots": list(dict.fromkeys(robots))}
        else:
            tags.pop(env_id, None)
        _write_tags(tags)
        envs = _scan()
    _publish(envs)
    return _envs[env_id]


def rescan() -> RescanResult:
    with lock:
        envs = _scan()
    _publish(envs)
    return RescanResult(dir=str(config.sim_envs_dir), scanned_at=now_iso(), envs=envs)


def delete_env(env_id: str) -> None:
    """Deletes the script or folder and its tags; refused while a task uses the environment."""
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
        tags = _read_tags()
        if tags.pop(env_id, None) is not None:
            _write_tags(tags)
        envs = _scan()
    _publish(envs)

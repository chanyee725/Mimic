"""Simulation: environment scripts (envs, scanner), evaluation jobs (jobs), the Isaac Sim server
(runner) and robot / tool previews (preview)."""

from app.services.simulation import envs, jobs, preview, runner, teleop
from app.services.simulation.envs import (
    delete_env,
    find_env,
    get_env,
    list_envs,
    list_robots,
    list_tools,
    rescan,
    rig_problem,
    robot_path,
    set_robots,
    thumbnail,
    tool_path,
)
from app.services.simulation.jobs import (
    ACTIVE,
    create_job,
    episode_video,
    get_episode,
    get_job,
    list_episodes,
    list_jobs,
    page_episodes,
    sim_config,
    stop_job,
)
from app.services.simulation.preview import model as preview_model

__all__ = [
    "ACTIVE",
    "create_job",
    "delete_env",
    "episode_video",
    "find_env",
    "get_env",
    "get_episode",
    "get_job",
    "list_envs",
    "list_episodes",
    "list_jobs",
    "list_robots",
    "list_tools",
    "page_episodes",
    "preview_model",
    "reset",
    "rescan",
    "rig_problem",
    "robot_path",
    "set_robots",
    "thumbnail",
    "tool_path",
    "runner",
    "teleop",
    "sim_config",
    "stop_job",
]


def reset() -> None:
    with envs.lock:
        teleop.reset()
        jobs.reset()
        envs.reset()


reset()

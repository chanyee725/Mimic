"""Simulation: environment scripts (envs, scanner), evaluation jobs (jobs) and the Isaac Sim server
(runner)."""

from app.services.simulation import envs, jobs, runner
from app.services.simulation.envs import (
    delete_env,
    find_env,
    get_env,
    list_envs,
    list_robots,
    rescan,
    rig_problem,
    robot_path,
    set_robots,
    thumbnail,
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
    "page_episodes",
    "reset",
    "rescan",
    "rig_problem",
    "robot_path",
    "set_robots",
    "thumbnail",
    "runner",
    "sim_config",
    "stop_job",
]


def reset() -> None:
    with envs.lock:
        jobs.reset()
        envs.reset()


reset()

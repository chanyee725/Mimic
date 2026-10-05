"""Simulation: scanned environments (envs), evaluation jobs (jobs), the folder scanner and the
Isaac Sim server (runner)."""

from app.services.simulation import envs, jobs, runner
from app.services.simulation.envs import (
    compat,
    env_compat,
    find_env,
    get_env,
    list_envs,
    model_compat,
    model_spec,
    rescan,
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
    "compat",
    "create_job",
    "env_compat",
    "episode_video",
    "find_env",
    "get_env",
    "get_episode",
    "get_job",
    "list_envs",
    "list_episodes",
    "list_jobs",
    "model_compat",
    "model_spec",
    "page_episodes",
    "reset",
    "rescan",
    "runner",
    "sim_config",
    "stop_job",
]


def reset() -> None:
    with envs.lock:
        jobs.reset()
        envs.reset()


reset()

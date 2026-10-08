"""Simulation endpoints — see docs/api/simulation.md."""

from fastapi import APIRouter

from . import envs, config, jobs, runner, teleop

PREFIX = "/sim"

router = APIRouter(tags=["simulation"])
router.include_router(envs.router, prefix=PREFIX)
router.include_router(config.router, prefix=PREFIX)
router.include_router(jobs.router, prefix=PREFIX)
router.include_router(runner.router, prefix=PREFIX)
router.include_router(teleop.router, prefix=PREFIX)

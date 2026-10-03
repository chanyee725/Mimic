"""Simulation endpoints — see docs/api/simulation.md."""

from fastapi import APIRouter

from . import envs, config, jobs

PREFIX = "/sim"

router = APIRouter(tags=["simulation"])
router.include_router(envs.router, prefix=PREFIX)
router.include_router(config.router, prefix=PREFIX)
router.include_router(jobs.router, prefix=PREFIX)

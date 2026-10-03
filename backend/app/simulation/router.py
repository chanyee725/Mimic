"""Simulation endpoints — see docs/api/simulation.md."""

from fastapi import APIRouter

router = APIRouter(prefix="/sim", tags=["simulation"])

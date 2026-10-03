"""Evaluate endpoints — see docs/api/models.md."""

from fastapi import APIRouter

router = APIRouter(prefix="/evaluate", tags=["evaluate"])

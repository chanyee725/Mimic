"""Training endpoints — see docs/api/training.md."""

from fastapi import APIRouter

router = APIRouter(prefix="/training", tags=["training"])

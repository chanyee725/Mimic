"""Datasets endpoints — see docs/api/datasets.md."""

from fastapi import APIRouter

from . import convert, datasets

router = APIRouter(tags=["datasets"])
router.include_router(convert.router)
router.include_router(datasets.router)

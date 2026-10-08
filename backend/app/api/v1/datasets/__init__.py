"""Datasets endpoints — see docs/api/datasets.md."""

from fastapi import APIRouter

from . import convert, datasets, hub, merge

router = APIRouter(tags=["datasets"])
router.include_router(convert.router)
# /datasets/merge… and /datasets/pull before the /datasets/{repo_id:path} routes
router.include_router(merge.router)
router.include_router(hub.router)
router.include_router(datasets.router)

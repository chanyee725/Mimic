import importlib

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.utils import time

# Every area keeps in-memory state; reset all of them so tests never leak into each other.
_AREAS = [
    "station",
    "tasks",
    "rigs",
    "capture",
    "recordings",
    "datasets",
    "training",
    "models",
    "evaluate",
    "simulation",
    "settings",
]


@pytest.fixture(autouse=True)
def _reset_services():
    for area in _AREAS:
        try:
            service = importlib.import_module(f"app.services.{area}")
        except ModuleNotFoundError:
            continue
        reset = getattr(service, "reset", None)
        if callable(reset):
            reset()
    time.set_clock(None)
    yield


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app(), base_url="http://test/api/v1")

import shutil
from pathlib import Path

import pytest

from app.configs.config import config
from app.core.events import bus
from app.services import simulation as service

FIXTURE_ENVS = Path(__file__).parent.parent / "fixtures" / "envs"


@pytest.fixture(autouse=True)
def envs_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Copy of the fixture environments; state reset before and after each test."""
    d = tmp_path / "envs"
    shutil.copytree(FIXTURE_ENVS, d)
    monkeypatch.setattr(config, "sim_dir", tmp_path)
    service.reset()
    yield d
    monkeypatch.undo()
    service.reset()


@pytest.fixture
def events():
    """Collects bus messages published during the test."""
    q = bus.subscribe()
    out: list[dict] = []

    def drain() -> list[dict]:
        while not q.empty():
            out.append(q.get_nowait())
        return out

    yield drain
    bus.unsubscribe(q)

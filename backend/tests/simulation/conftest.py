import shutil
from pathlib import Path

import pytest

from app.configs.config import REPO_ROOT, config
from app.core.events import bus
from app.services import simulation as service

REPO_ENVS = REPO_ROOT / "sim" / "envs"


@pytest.fixture(autouse=True)
def envs_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Copy of the repo's example environments; state reset before and after each test."""
    d = tmp_path / "envs"
    shutil.copytree(REPO_ENVS, d)
    monkeypatch.setattr(config, "sim_envs_dir", d)
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

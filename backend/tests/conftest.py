import importlib
import os
import shutil
import tempfile
from datetime import timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Secret env vars (also the names in .env); tests never see the developer's values
SECRET_VARS = ("HF_TOKEN", "RUNPOD_API_KEY", "SLACK_WEBHOOK_URL")

# Services read their files at import time; keep them out of the repo's data/
os.environ.setdefault("VLA_DATA_DIR", tempfile.mkdtemp(prefix="vla-data-"))
# Never read or write the repo-root .env (config and settings load it at import time)
os.environ["VLA_ENV_FILE_PATH"] = os.path.join(tempfile.mkdtemp(prefix="vla-env-"), ".env")
for _var in SECRET_VARS:
    os.environ.pop(_var, None)
# Never open real serial ports / cameras or read LeRobot calibration files (tests/support.py has a fake)
os.environ["VLA_DEVICE_DRIVER"] = "none"

from app.configs.config import config  # noqa: E402
from app.main import create_app  # noqa: E402
from app.utils import time  # noqa: E402

FIXTURES = Path(__file__).parent / "fixtures"

# Every area keeps in-memory state; reset all of them so tests never leak into each other.
_AREAS = [
    "settings",
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
]


def copy_rigs(data_dir: Path) -> None:
    """Rig files are station config (committed under data/rigs): every test starts with them."""
    shutil.copytree(FIXTURES / "rigs", data_dir / "rigs", dirs_exist_ok=True)


def add_tasks(*task_ids: str) -> None:
    """Copies fixture task files (tests/fixtures/tasks/<id>.yaml; all when none named), reloads."""
    from app.services import tasks

    folder = config.data_dir / "tasks"
    folder.mkdir(parents=True, exist_ok=True)
    names = [f"{i}.yaml" for i in task_ids] or [p.name for p in (FIXTURES / "tasks").glob("*")]
    for name in names:
        shutil.copy(FIXTURES / "tasks" / name, folder / name)
    tasks.reset()


def connect_devices(health: str = "ok") -> None:
    """Pretend drivers report every rig device as connected (none exist yet)."""
    from app.services import rigs

    for d in rigs.list_devices():
        rigs.set_device_state(d.id, health=health)


@pytest.fixture(autouse=True)
def _reset_services(tmp_path_factory, monkeypatch):
    # Fresh data folder (rig files only) and .env per test: every service reloads
    config.data_dir = tmp_path_factory.mktemp("data")
    copy_rigs(config.data_dir)
    monkeypatch.setattr(config, "env_file_path", tmp_path_factory.mktemp("env") / ".env")
    for var in SECRET_VARS:
        monkeypatch.delenv(var, raising=False)
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


@pytest.fixture
def task():
    """The stack-two-blocks task on so101-kit."""
    from app.services import tasks

    add_tasks("stack-two-blocks")
    return tasks.require_task("stack-two-blocks")


@pytest.fixture
def devices_online():
    connect_devices()


def record_episode(client, task_id: str = "stack-two-blocks", outcome: str = "success") -> dict:
    """Records and saves one episode through the capture API (devices must be connected)."""
    from app.services.capture import session

    r = client.post("/capture/start", json={"taskId": task_id, "operator": "OP-01"})
    assert r.status_code == 200, r.text
    # Jump past the countdown, into the recording
    t = session._session.recording_at + timedelta(seconds=2)
    time.set_clock(lambda: t)
    try:
        r = client.post("/capture/save", json={"outcome": outcome})
    finally:
        time.set_clock(None)
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture
def record(client, devices_online):
    """record(task_id=..., outcome=...) saves one real episode (MCAP + sidecar) via capture."""
    return lambda task_id="stack-two-blocks", outcome="success": record_episode(
        client, task_id, outcome
    )

import importlib
import os
import tempfile
from pathlib import Path

import pytest
import yaml
from fastapi.testclient import TestClient
from pydantic.alias_generators import to_snake

# Secret env vars (also the names in .env); tests never see the developer's values
SECRET_VARS = ("HF_TOKEN", "RUNPOD_API_KEY", "SLACK_WEBHOOK_URL")

# Services seed their YAML files at import time; keep them out of the repo's data/
os.environ.setdefault("VLA_DATA_DIR", tempfile.mkdtemp(prefix="vla-data-"))
# Never read or write the repo-root .env (config and settings load it at import time)
os.environ["VLA_ENV_FILE_PATH"] = os.path.join(tempfile.mkdtemp(prefix="vla-env-"), ".env")
for _var in SECRET_VARS:
    os.environ.pop(_var, None)

from app.seeds import load  # noqa: E402


def pin_raw_dir(data_dir: Path) -> None:
    """Settings storage.raw_path → <data_dir>/recordings (the default data/recordings is the repo's)."""
    p = data_dir / "settings" / "storage.yaml"
    if p.exists():
        return
    values = {to_snake(k): v for k, v in load("settings", "SETTINGS")["storage"].items()}
    values["raw_path"] = str(data_dir / "recordings")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(yaml.safe_dump(values, sort_keys=False))


# Services load at import time: pin the raw folder before the first one does
pin_raw_dir(Path(os.environ["VLA_DATA_DIR"]))

from app.configs.config import config  # noqa: E402
from app.main import create_app  # noqa: E402
from app.utils import time  # noqa: E402

# Every area keeps in-memory state; reset all of them so tests never leak into each other.
# Settings first: recordings read the raw folder from it.
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


@pytest.fixture(autouse=True)
def _reset_services(tmp_path_factory, monkeypatch):
    # Fresh, empty data folder and .env per test: every service reseeds its files
    config.data_dir = tmp_path_factory.mktemp("data")
    pin_raw_dir(config.data_dir)
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

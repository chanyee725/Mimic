import copy
import shutil

import pytest

from app.configs.config import config
from app.services import simulation, tasks
from tests.conftest import FIXTURES, add_tasks

TASK = "stack-two-blocks"


@pytest.fixture(autouse=True)
def envs(tmp_path, monkeypatch):
    d = tmp_path / "envs"
    shutil.copytree(FIXTURES / "envs", d)
    monkeypatch.setattr(config, "sim_envs_dir", d)
    simulation.reset()
    add_tasks(TASK)
    yield d
    monkeypatch.undo()
    simulation.reset()


@pytest.fixture
def sim_task(client):
    body = copy.deepcopy(client.get(f"/tasks/{TASK}").json())
    for k in ("collected", "version", "updatedAt", "updatedBy"):
        body.pop(k)
    return body | {"id": "sim-stack", "name": "Sim stack", "envId": "table"}


def env_errors(r):
    return [e for e in r.json()["error"]["details"]["errors"] if e["loc"][-1] == "envId"]


def test_real_task_has_no_env(client):
    assert client.get(f"/tasks/{TASK}").json()["envId"] is None
    assert "env:" not in client.get(f"/tasks/{TASK}/yaml").text


def test_isaac_sim_task_stores_its_env(client, sim_task):
    r = client.post("/tasks", json=sim_task)
    assert r.status_code == 201, r.text
    assert r.json()["envId"] == "table"
    assert "env: table\n" in client.get("/tasks/sim-stack/yaml").text
    tasks.reset()  # reloads from the file
    assert tasks.require_task("sim-stack").env_id == "table"


def test_unknown_env_is_refused(client, sim_task):
    r = client.post("/tasks", json=sim_task | {"envId": "nope"})
    assert r.status_code == 422 and "unknown environment" in env_errors(r)[0]["msg"]


def test_rig_folder_env_must_match_the_task_rig(client, sim_task, envs):
    (envs / "so101-bimanual-kit").mkdir()
    (envs / "so101-bimanual-kit" / "duo.usda").write_text("#usda 1.0\n")
    simulation.rescan()
    assert client.post("/tasks", json=sim_task | {"envId": "arm-table"}).status_code == 201
    r = client.post("/tasks", json=sim_task | {"id": "sim-duo", "envId": "duo"})
    assert r.status_code == 422
    assert env_errors(r)[0]["msg"] == "environment 'duo' belongs to rig 'so101-bimanual-kit'"


def test_capture_refuses_isaac_sim_tasks(client, sim_task):
    client.post("/tasks", json=sim_task)
    r = client.post("/capture/start", json={"taskId": "sim-stack", "operator": "OP-01"})
    assert r.status_code == 503 and "not connected" in r.json()["error"]["message"]


def test_recordings_filter_by_kind(client, devices_online, record):
    record()
    assert client.get("/recordings?kind=real").json()["total"] == 1
    assert client.get("/recordings?kind=sim").json()["total"] == 0
    assert client.get("/recordings").json()["items"][0]["simEnv"] is None

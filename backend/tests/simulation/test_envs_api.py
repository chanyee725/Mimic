from pathlib import Path

import yaml

from app.configs.config import config
from app.services import tasks
from tests.conftest import FIXTURES, add_tasks


def test_list_envs(client, envs_dir: Path):
    envs = client.get("/sim/envs").json()
    assert [e["id"] for e in envs] == ["drawer", "kitchen", "table"]
    drawer = envs[0]
    assert drawer["path"] == str((envs_dir / "drawer").resolve())
    assert drawer["scene"] == "scene.usda"
    assert [f["path"] for f in drawer["files"]] == ["assets/handle.usda", "scene.usda"]
    assert set(drawer) == {
        "id",
        "name",
        "path",
        "scene",
        "sizeKB",
        "files",
        "registeredAt",
        "updatedAt",
    }


def test_get_env(client):
    assert client.get("/sim/envs/table").json()["scene"] == "table.usda"
    r = client.get("/sim/envs/nope")
    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"


def test_rescan_picks_up_changes(client, envs_dir: Path, events):
    registered = client.get("/sim/envs/table").json()["registeredAt"]
    (envs_dir / "garage.usdc").write_text("#usda 1.0\n")
    (envs_dir / "kitchen.usd").unlink()
    assert client.get("/sim/envs/garage").status_code == 404  # not before a rescan

    body = client.post("/sim/envs/rescan").json()
    assert body["dir"] == str(envs_dir) and body["scannedAt"]
    ids = [e["id"] for e in body["envs"]]
    assert ids == ["drawer", "garage", "table"]
    # First-seen time survives rescans
    assert client.get("/sim/envs/table").json()["registeredAt"] == registered
    msgs = [m for m in events() if m["type"] == "sim.envs"]
    assert len(msgs) == 1 and [e["id"] for e in msgs[0]["data"]["envs"]] == ids


def test_delete_env(client, envs_dir: Path):
    assert client.delete("/sim/envs/drawer").status_code == 204
    assert not (envs_dir / "drawer").exists()
    assert client.delete("/sim/envs/kitchen").status_code == 204
    assert not (envs_dir / "kitchen.usd").exists()
    assert [e["id"] for e in client.get("/sim/envs").json()] == ["table"]
    assert client.delete("/sim/envs/nope").status_code == 404


def test_delete_refused_while_a_task_uses_it(client, envs_dir: Path):
    doc = yaml.safe_load((FIXTURES / "tasks" / "stack-two-blocks.yaml").read_text())
    folder = config.data_dir / "tasks"
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "sim-stack.yaml").write_text(
        yaml.safe_dump(doc | {"task_id": "sim-stack", "env": "table"})
    )
    tasks.reset()
    r = client.delete("/sim/envs/table")
    assert r.status_code == 409 and r.json()["error"]["details"]["tasks"] == ["sim-stack"]
    assert (envs_dir / "table.usda").exists()


def test_compat_route_is_gone(client):
    add_tasks("stack-two-blocks")
    assert client.get("/sim/envs/table/compat").status_code in (404, 405)


def test_config(client, envs_dir: Path):
    cfg = client.get("/sim/config").json()
    assert cfg["envsDir"] == str(envs_dir)
    # gpu comes from nvidia-smi (see test_jobs_api); null on machines without one
    assert cfg["gpu"] is None or cfg["gpu"]["id"] == "cuda:0"

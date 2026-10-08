from pathlib import Path

import yaml

from app.configs.config import config
from app.services import tasks
from tests.conftest import FIXTURES, add_tasks
from tests.support import write_sim_robots, write_sim_tool


def test_list_envs(client, envs_dir: Path):
    envs = client.get("/sim/envs").json()
    assert [e["id"] for e in envs] == ["arm-table", "drawer", "kitchen", "table"]
    drawer = envs[1]
    assert drawer["path"] == str((envs_dir / "drawer").resolve())
    assert drawer["script"] == "env.py"
    assert [f["path"] for f in drawer["files"]] == [
        "assets/handle.usda",
        "env.py",
        "thumbnail.png",
    ]
    assert drawer["robots"] == [] and drawer["thumbnail"]
    assert drawer["rigIds"] == ["so101-bimanual-kit", "so101-kit"]  # untagged: any rig
    assert set(drawer) == {
        "id",
        "name",
        "path",
        "script",
        "sizeKB",
        "files",
        "registeredAt",
        "updatedAt",
        "robots",
        "rigIds",
        "thumbnail",
    }
    # A top-level script with its thumbnail beside it
    arm = envs[0]
    assert arm["script"] == "arm-table.py" and arm["thumbnail"]
    assert arm["path"] == str((envs_dir / "arm-table.py").resolve())
    assert not envs[3]["thumbnail"]


def test_robot_tags(client, tmp_path: Path):
    assert client.get("/sim/robots").json() == []
    write_sim_robots("so101_follower", "koch_follower")
    robots = client.get("/sim/robots").json()
    assert [r["id"] for r in robots] == ["koch_follower", "so101_follower"]
    assert robots[0]["files"] == [{"path": "koch_follower.usda", "sizeKB": 1}]

    r = client.patch("/sim/envs/table", json={"robots": ["so101_follower"]})
    assert r.status_code == 200, r.text
    assert r.json()["robots"] == ["so101_follower"]
    assert r.json()["rigIds"] == ["so101-bimanual-kit", "so101-kit"]
    assert yaml.safe_load((tmp_path / "envs.yaml").read_text()) == {
        "table": {"robots": ["so101_follower"]}
    }
    # A robot no rig has: fits no rig
    body = client.patch("/sim/envs/table", json={"robots": ["koch_follower"]}).json()
    assert body["rigIds"] == []
    # Tags survive a rescan; unknown robots are refused; [] clears them
    assert client.post("/sim/envs/rescan").json()["envs"][3]["robots"] == ["koch_follower"]
    r = client.patch("/sim/envs/table", json={"robots": ["nope"]})
    assert r.status_code == 422 and r.json()["error"]["details"]["robots"] == ["nope"]
    assert client.patch("/sim/envs/table", json={"robots": []}).json()["robots"] == []
    assert yaml.safe_load((tmp_path / "envs.yaml").read_text()) == {}
    assert client.patch("/sim/envs/nope", json={"robots": []}).status_code == 404


def test_thumbnail(client):
    r = client.get("/sim/envs/drawer/thumbnail")
    assert r.status_code == 200 and r.headers["content-type"] == "image/png"
    assert r.content.startswith(b"\x89PNG")
    assert client.get("/sim/envs/arm-table/thumbnail").status_code == 200
    assert client.get("/sim/envs/table/thumbnail").status_code == 404
    assert client.get("/sim/envs/nope/thumbnail").status_code == 404


def test_get_env(client):
    assert client.get("/sim/envs/table").json()["script"] == "table.py"
    r = client.get("/sim/envs/nope")
    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"


def test_rescan_picks_up_changes(client, envs_dir: Path, events):
    registered = client.get("/sim/envs/table").json()["registeredAt"]
    (envs_dir / "garage.py").write_text('def build(scene):\n    scene.add("table")\n')
    (envs_dir / "kitchen.py").unlink()
    assert client.get("/sim/envs/garage").status_code == 404  # not before a rescan

    body = client.post("/sim/envs/rescan").json()
    assert body["dir"] == str(envs_dir) and body["scannedAt"]
    ids = [e["id"] for e in body["envs"]]
    assert ids == ["arm-table", "drawer", "garage", "table"]
    # First-seen time survives rescans
    assert client.get("/sim/envs/table").json()["registeredAt"] == registered
    msgs = [m for m in events() if m["type"] == "sim.envs"]
    assert len(msgs) == 1 and [e["id"] for e in msgs[0]["data"]["envs"]] == ids


def test_delete_env(client, envs_dir: Path):
    assert client.delete("/sim/envs/drawer").status_code == 204
    assert not (envs_dir / "drawer").exists()
    assert client.delete("/sim/envs/kitchen").status_code == 204
    assert not (envs_dir / "kitchen.py").exists()
    assert [e["id"] for e in client.get("/sim/envs").json()] == ["arm-table", "table"]
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
    assert (envs_dir / "table.py").exists()


def test_compat_route_is_gone(client):
    add_tasks("stack-two-blocks")
    assert client.get("/sim/envs/table/compat").status_code in (404, 405)


def test_config(client, envs_dir: Path):
    cfg = client.get("/sim/config").json()
    assert cfg["envsDir"] == str(envs_dir)
    # gpu comes from nvidia-smi (see test_jobs_api); null on machines without one
    assert cfg["gpu"] is None or cfg["gpu"]["id"] == "cuda:0"


def test_tools(client):
    assert client.get("/sim/tools").json() == []
    write_sim_tool("hand")
    [tool] = client.get("/sim/tools").json()
    assert tool["id"] == "hand" and tool["sizeKB"] == 1
    assert [f["path"] for f in tool["files"]] == ["hand.usda", "payloads/base.usda"]

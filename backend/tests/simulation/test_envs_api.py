import shutil
from pathlib import Path


def test_list_envs(client, envs_dir: Path):
    envs = client.get("/sim/envs").json()
    ids = [e["id"] for e in envs]
    assert ids == sorted(ids) and "_template" not in ids
    stack = next(e for e in envs if e["id"] == "stack-two-blocks")
    assert stack["path"] == str((envs_dir / "stack-two-blocks").resolve())
    assert stack["taskId"] == "stack-two-blocks" and stack["actionDim"] == 6
    assert stack["manifest"].startswith("name: Tabletop, two blocks")


def test_list_envs_by_state(client):
    invalid = client.get("/sim/envs", params={"state": "invalid"}).json()
    assert [e["id"] for e in invalid] == ["pour-into-cup"]
    ready = client.get("/sim/envs", params={"state": "ready"}).json()
    assert ready and all(e["state"] == "ready" for e in ready)
    assert client.get("/sim/envs", params={"state": "bogus"}).status_code == 422


def test_get_env(client):
    env = client.get("/sim/envs/pour-into-cup").json()
    assert env["state"] == "invalid"
    assert env["error"] == "env.yaml: success.py not found (expected success.py:check)"
    r = client.get("/sim/envs/nope")
    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"


def test_rescan_picks_up_changes(client, envs_dir: Path, events):
    registered = client.get("/sim/envs/stack-two-blocks").json()["registeredAt"]
    shutil.copytree(envs_dir / "stack-two-blocks", envs_dir / "stack-copy")
    shutil.rmtree(envs_dir / "clutter-stress")
    (envs_dir / "pour-into-cup" / "success.py").write_text("def check(state): ...\n")

    # Not visible before a rescan
    assert client.get("/sim/envs/stack-copy").status_code == 404

    r = client.post("/sim/envs/rescan")
    assert r.status_code == 200
    body = r.json()
    assert body["dir"] == str(envs_dir) and body["scannedAt"]
    ids = [e["id"] for e in body["envs"]]
    assert "stack-copy" in ids and "clutter-stress" not in ids
    assert client.get("/sim/envs/pour-into-cup").json()["state"] == "ready"
    # First-seen time survives rescans
    assert client.get("/sim/envs/stack-two-blocks").json()["registeredAt"] == registered

    msgs = [m for m in events() if m["type"] == "sim.envs"]
    assert len(msgs) == 1 and [e["id"] for e in msgs[0]["data"]["envs"]] == ids


def test_compat_ready_env(client):
    rows = client.get("/sim/envs/stack-two-blocks/compat").json()
    assert {r["modelId"] for r in rows} == {
        "m-stack-20k",
        "m-stack-10k",
        "m-open-drawer-20k",
        "m-open-drawer-15k",
    }
    assert all(r["usable"] and r["issues"] == [] for r in rows)
    # Models for the environment's task come first
    assert {rows[0]["modelId"], rows[1]["modelId"]} == {"m-stack-20k", "m-stack-10k"}


def test_compat_missing_camera(client):
    rows = client.get("/sim/envs/top-only-demo/compat").json()
    assert all(not r["usable"] for r in rows)
    assert rows[0]["issues"] == [{"level": "error", "text": "Missing camera wrist"}]


def test_compat_uncalibrated_is_warning(client):
    rows = client.get("/sim/envs/sort-by-color/compat").json()
    assert all(r["usable"] for r in rows)
    assert rows[0]["issues"] == [{"level": "warn", "text": "Not matched to the real rig"}]


def test_compat_invalid_env_and_action_size(client, envs_dir: Path):
    rows = client.get("/sim/envs/pour-into-cup/compat").json()
    assert rows[0]["issues"][0] == {
        "level": "error",
        "text": "env.yaml: success.py not found (expected success.py:check)",
    }
    manifest = envs_dir / "clutter-stress" / "env.yaml"
    manifest.write_text(manifest.read_text().replace("action_dim: 6", "action_dim: 7"))
    client.post("/sim/envs/rescan")
    rows = client.get("/sim/envs/clutter-stress/compat").json()
    assert rows[0]["issues"] == [{"level": "error", "text": "Action size 7, model expects 6"}]


def test_compat_unknown_env(client):
    assert client.get("/sim/envs/nope/compat").status_code == 404


def test_config(client, envs_dir: Path):
    cfg = client.get("/sim/config").json()
    assert cfg["envsDir"] == str(envs_dir)
    assert cfg["gpu"] == {"id": "cuda:0", "name": "RTX 4090", "vram": "24 GB", "busyBy": "sim_012"}
    client.post("/sim/jobs/sim_012/stop")
    # The queued job takes the GPU
    assert client.get("/sim/config").json()["gpu"]["busyBy"] == "sim_013"
    client.post("/sim/jobs/sim_013/stop")
    assert client.get("/sim/config").json()["gpu"]["busyBy"] is None

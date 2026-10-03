"""Behaviour that spans areas."""

from pathlib import Path

from app.configs.config import REPO_ROOT, Config, config


def test_capture_save_counts_toward_task(client):
    before = client.get("/tasks/stack-two-blocks").json()
    client.post("/capture/start", json={"taskId": "stack-two-blocks", "operator": "OP-01"})
    from app.services.capture import session
    from app.utils import time

    t = session._session.recording_at.replace(second=59)
    time.set_clock(lambda: t)
    r = client.post("/capture/save", json={"outcome": "success"})
    time.set_clock(None)
    assert r.status_code == 201
    after = client.get("/tasks/stack-two-blocks").json()
    assert after["collected"] == before["collected"] + 1
    assert after["version"] == before["version"]


def test_sim_envs_dir_comes_from_config(client, tmp_path, monkeypatch):
    # VLA_SIM_ENVS_DIR is the only source; a rescan picks up the new folder
    monkeypatch.setattr(config, "sim_envs_dir", tmp_path)
    env = tmp_path / "solo"
    env.mkdir()
    (env / "scene.usd").write_text("#usda 1.0\n")
    (env / "success.py").write_text("def check(state):\n    return False, False, None\n")
    (env / "env.yaml").write_text(
        "name: Solo\nscene: scene.usd\ncameras:\n  top: {}\naction_dim: 6\n"
        "episode:\n  max_seconds: 30\n  success: success.py:check\n"
    )
    assert client.post("/sim/envs/rescan").status_code == 200
    assert client.get("/sim/config").json()["envsDir"] == str(tmp_path)
    assert [e["id"] for e in client.get("/sim/envs").json()] == ["solo"]


def test_config_paths_start_at_repo_root(monkeypatch):
    monkeypatch.setenv("VLA_SIM_ENVS_DIR", "sim/envs")
    monkeypatch.setenv("VLA_DATA_DIR", "~/vla-data")
    c = Config()
    assert c.sim_envs_dir == REPO_ROOT / "sim" / "envs"
    assert c.data_dir == Path("~/vla-data").expanduser()


def test_size_fields_use_spec_casing(client):
    assert "sizeMB" in client.get("/models").json()[0]
    assert "sizeGB" in client.get("/datasets").json()[0]
    assert "sizeMB" in client.get("/recordings").json()["items"][0]

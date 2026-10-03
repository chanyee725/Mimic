"""Behaviour that spans areas."""

from app.core.config import config


def test_capture_save_counts_toward_task(client):
    before = client.get("/tasks/stack-two-blocks").json()
    client.post("/capture/start", json={"taskId": "stack-two-blocks", "operator": "OP-01"})
    from app.capture import service as capture

    capture.set_clock(lambda: capture._session.recording_at.replace(second=59))
    r = client.post("/capture/save", json={"outcome": "success"})
    capture.set_clock(None)
    assert r.status_code == 201
    after = client.get("/tasks/stack-two-blocks").json()
    assert after["collected"] == before["collected"] + 1
    assert after["version"] == before["version"]


def test_sim_envs_path_setting_moves_the_scanner(client, tmp_path, monkeypatch):
    monkeypatch.setattr(config, "sim_envs_dir", config.sim_envs_dir)
    env = tmp_path / "solo"
    env.mkdir()
    (env / "scene.usd").write_text("#usda 1.0\n")
    (env / "success.py").write_text("def check(state):\n    return False, False, None\n")
    (env / "env.yaml").write_text(
        "name: Solo\nscene: scene.usd\ncameras:\n  top: {}\naction_dim: 6\n"
        "episode:\n  max_seconds: 30\n  success: success.py:check\n"
    )
    version = client.get("/settings").json()["version"]
    r = client.patch("/settings/training", json={"version": version, "simEnvsPath": str(tmp_path)})
    assert r.status_code == 200
    assert client.get("/sim/config").json()["envsDir"] == str(tmp_path)
    assert [e["id"] for e in client.get("/sim/envs").json()] == ["solo"]


def test_size_fields_use_spec_casing(client):
    assert "sizeMB" in client.get("/models").json()[0]
    assert "sizeGB" in client.get("/datasets").json()[0]
    assert "sizeMB" in client.get("/recordings").json()["items"][0]

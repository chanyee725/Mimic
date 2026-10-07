"""Behaviour that spans areas."""

from pathlib import Path

from app.configs.config import REPO_ROOT, Config, config


def test_capture_save_counts_toward_task(client, task, record):
    before = client.get("/tasks/stack-two-blocks").json()
    record()
    after = client.get("/tasks/stack-two-blocks").json()
    assert after["collected"] == before["collected"] + 1
    assert after["version"] == before["version"]


def test_sim_envs_dir_comes_from_config(client, tmp_path, monkeypatch):
    # VLA_SIM_DIR is the only source; a rescan picks up the new stage under envs/
    monkeypatch.setattr(config, "sim_dir", tmp_path)
    (tmp_path / "envs").mkdir()
    (tmp_path / "envs" / "solo.usd").write_text("#usda 1.0\n")
    assert client.post("/sim/envs/rescan").status_code == 200
    assert client.get("/sim/config").json()["envsDir"] == str(tmp_path / "envs")
    assert [e["id"] for e in client.get("/sim/envs").json()] == ["solo"]


def test_sim_dir_defaults_under_data(monkeypatch):
    monkeypatch.delenv("VLA_SIM_DIR", raising=False)
    monkeypatch.setenv("VLA_DATA_DIR", "station/data")
    c = Config(_env_file=None)
    assert c.sim_envs_dir == REPO_ROOT / "station" / "data" / "sims" / "envs"
    assert c.sim_robot_dir == REPO_ROOT / "station" / "data" / "sims" / "robot"


def test_config_paths_start_at_repo_root(monkeypatch):
    monkeypatch.setenv("VLA_SIM_DIR", "station/sims")
    monkeypatch.setenv("VLA_DATA_DIR", "~/vla-data")
    monkeypatch.setenv("VLA_CONFIG_DIR", "station/config")
    c = Config()
    assert c.sim_envs_dir == REPO_ROOT / "station" / "sims" / "envs"
    assert c.data_dir == Path("~/vla-data").expanduser()
    assert c.config_dir == REPO_ROOT / "station" / "config"
    assert c.calibration_dir == c.config_dir / "calibration"


def test_size_fields_use_spec_casing(client, task):
    from app.services import datasets
    from tests.support import write_model, write_recording

    write_model("m-a")
    write_recording(1)
    client.post("/convert", json={"taskId": "stack-two-blocks", "repoId": "local/a"})
    datasets.wait("local/a")
    assert "sizeMB" in client.get("/models").json()[0]
    assert "sizeGB" in client.get("/datasets").json()[0]
    assert "sizeMB" in client.get("/recordings").json()["items"][0]

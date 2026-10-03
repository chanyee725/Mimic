"""settings.yaml / secrets.yaml persistence."""

import stat

import yaml

from app.configs.config import config
from app.core import storage
from app.services import settings as service


def read_file(name):
    return yaml.safe_load(storage.path(name).read_text())


def test_seed_writes_snake_case_file():
    doc = read_file("settings.yaml")
    assert doc["version"] == 1
    assert doc["recording"]["chunk_mb"] == 4
    assert "private_by_default" in doc["integrations"]["hf"]
    assert doc["integrations"]["hf"]["token"] == {"set": True, "last4": "3kQz"}
    assert "simEnvsPath" not in doc["training"] and doc["training"]["sim_envs_path"]
    assert {"key", "label", "on"} <= set(doc["notifications"]["events"][0])


def test_patch_persists_and_reloads(client):
    body = {"version": 1, "crf": 24, "chunkMB": 8}
    assert client.patch("/settings/recording", json=body).status_code == 200
    assert read_file("settings.yaml")["recording"]["chunk_mb"] == 8
    body = {"version": 2, "events": [{"key": "sim_done", "on": True}]}
    assert client.patch("/settings/notifications", json=body).status_code == 200

    service.reset()  # data dir kept
    s = client.get("/settings").json()
    assert s["version"] == 3
    assert (s["recording"]["crf"], s["recording"]["chunkMB"]) == (24, 8)
    assert next(e for e in s["notifications"]["events"] if e["key"] == "sim_done")["on"] is True


def test_connection_test_persists(client):
    client.post("/settings/test/hf")
    assert read_file("settings.yaml")["integrations"]["hf"]["state"] == "ok"


def test_hand_edited_file_loads(client):
    doc = read_file("settings.yaml")
    doc["station"]["name"] = "Hand Bench"
    doc["recording"]["chunk_mb"] = 16
    first = doc["notifications"]["events"][0]
    first["on"] = not first["on"]
    doc["version"] = 7
    storage.path("settings.yaml").write_text(yaml.safe_dump(doc, sort_keys=False))
    service.reset()
    s = client.get("/settings").json()
    assert (s["version"], s["station"]["name"], s["recording"]["chunkMB"]) == (7, "Hand Bench", 16)
    assert s["notifications"]["events"][0]["on"] is first["on"]


def test_secret_put_goes_to_private_file(client):
    value = "hf_super_secret_value_WXYZ"
    assert client.put("/settings/secrets/hf_token", json={"value": value}).status_code == 200
    secrets = storage.path("secrets.yaml")
    assert stat.S_IMODE(secrets.stat().st_mode) == 0o600
    assert secrets.read_text().startswith("#")
    assert read_file("secrets.yaml") == {"hf_token": value}
    text = storage.path("settings.yaml").read_text()
    assert value not in text and "secret_value" not in text
    token = read_file("settings.yaml")["integrations"]["hf"]["token"]
    assert token == {"set": True, "last4": "WXYZ"}

    service.reset()
    assert service._secrets == {"hf_token": value}
    assert service.get_settings().integrations.hf.token.last4 == "WXYZ"


def test_delete_secret_removes_it(client):
    client.put("/settings/secrets/wandb_api_key", json={"value": "wandb-key-1234"})
    assert client.delete("/settings/secrets/wandb_api_key").status_code == 200
    assert "wandb_api_key" not in (read_file("secrets.yaml") or {})
    assert read_file("settings.yaml")["integrations"]["wandb"]["api_key"] == {"set": False}
    service.reset()
    assert "wandb_api_key" not in service._secrets


def test_secrets_file_wins_over_settings_last4(client):
    storage.write_text("secrets.yaml", "runpod_api_key: rp-abcd9876\n", private=True)
    service.reset()
    key = client.get("/settings").json()["integrations"]["runpod"]["apiKey"]
    assert key == {"set": True, "last4": "9876"}
    assert read_file("settings.yaml")["integrations"]["runpod"]["api_key"]["last4"] == "9876"


def test_broken_file_falls_back_untouched(client):
    p = storage.path("settings.yaml")
    for broken in ("station: [unclosed\n", "version: 1\nrecording: {crf: 999}\n"):
        p.write_text(broken)
        service.reset()
        assert p.read_text() == broken
        assert client.get("/settings").json()["version"] == 1


def test_persisted_sim_envs_path_applied(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "sim_envs_dir", config.sim_envs_dir)
    envs = tmp_path / "my-envs"
    doc = read_file("settings.yaml")
    doc["training"]["sim_envs_path"] = str(envs)
    storage.write("settings.yaml", doc)
    service.reset()
    assert config.sim_envs_dir == envs

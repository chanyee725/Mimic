"""Secrets in .env (config.env_file_path, a temp file in tests) and the environment."""

import stat

import yaml
from dotenv import dotenv_values

from app.configs.config import config
from app.core import storage
from app.services import settings as service

OTHER_LINES = "# station overrides\nVLA_TIMEZONE=Asia/Seoul\n\n# keep me\n"


def env_text():
    return config.env_file_path.read_text()


def env_values():
    return dotenv_values(config.env_file_path)


def test_no_secrets_by_default(client):
    s = client.get("/settings").json()
    assert s["integrations"]["hf"]["token"] == {"set": False}
    assert s["integrations"]["runpod"]["apiKey"] == {"set": False}
    assert s["notifications"]["slackWebhook"] == {"set": False}
    assert not config.env_file_path.exists()


def test_put_creates_private_env_file(client):
    value = "hf_super_secret_value_WXYZ"
    r = client.put("/settings/secrets/hf_token", json={"value": value})
    assert r.status_code == 200 and r.json() == {"set": True, "last4": "WXYZ"}
    assert stat.S_IMODE(config.env_file_path.stat().st_mode) == 0o600
    assert env_values()["HF_TOKEN"] == value
    # GET shows last4 only
    text = client.get("/settings").text
    assert value not in text and "super_secret" not in text
    assert client.get("/settings").json()["integrations"]["hf"]["token"]["last4"] == "WXYZ"


def test_put_and_delete_keep_other_lines(client):
    config.env_file_path.write_text(OTHER_LINES + "RUNPOD_API_KEY=old-runpod-key\n")
    config.env_file_path.chmod(0o644)
    service.reset()
    assert client.get("/settings").json()["integrations"]["runpod"]["apiKey"]["last4"] == "-key"

    client.put("/settings/secrets/runpod_api_key", json={"value": "new-runpod-1234"})
    client.put("/settings/secrets/slack_webhook", json={"value": "https://hooks.example/abcd"})
    assert env_text().startswith(OTHER_LINES)
    assert stat.S_IMODE(config.env_file_path.stat().st_mode) == 0o600
    values = env_values()
    assert values["RUNPOD_API_KEY"] == "new-runpod-1234"
    assert values["SLACK_WEBHOOK_URL"] == "https://hooks.example/abcd"
    assert values["VLA_TIMEZONE"] == "Asia/Seoul"

    assert client.delete("/settings/secrets/runpod_api_key").json() == {"set": False}
    assert "RUNPOD_API_KEY" not in env_values()
    assert env_text().startswith(OTHER_LINES)
    assert not service.has_secret("runpod_api_key")
    # Deleting a missing key is fine
    assert client.delete("/settings/secrets/hf_token").status_code == 200

    service.reset()
    s = client.get("/settings").json()
    assert s["integrations"]["runpod"]["apiKey"] == {"set": False}
    assert s["notifications"]["slackWebhook"] == {"set": True, "last4": "abcd"}


def test_secret_write_leaves_part_files_alone(client):
    before = {p.name: p.read_text() for p in storage.list_yaml("settings")}
    client.put("/settings/secrets/runpod_api_key", json={"value": "rp-key-9F2A"})
    after = {p.name: p.read_text() for p in storage.list_yaml("settings")}
    assert after == before
    for text in after.values():
        assert "9F2A" not in text and "api_key" not in yaml.safe_load(text)


def test_env_var_overrides_file(client, monkeypatch):
    config.env_file_path.write_text("RUNPOD_API_KEY=from-file-1111\n")
    monkeypatch.setenv("RUNPOD_API_KEY", "from-env-2222")
    service.reset()
    key = client.get("/settings").json()["integrations"]["runpod"]["apiKey"]
    assert key == {"set": True, "last4": "2222"}
    assert client.post("/settings/test/runpod").json()["state"] == "ok"


def test_migrates_secrets_yaml(client):
    config.env_file_path.write_text("HF_TOKEN=already-set-AAAA\n")
    legacy = "hf_token: legacy-hf-BBBB\nrunpod_api_key: legacy-rp-CCCC\nbogus: x\n"
    storage.write_text("secrets.yaml", legacy, private=True)
    service.reset()
    assert not storage.exists("secrets.yaml")
    values = env_values()
    assert values["HF_TOKEN"] == "already-set-AAAA"  # existing key wins
    assert values["RUNPOD_API_KEY"] == "legacy-rp-CCCC"
    assert "bogus" not in values
    assert stat.S_IMODE(config.env_file_path.stat().st_mode) == 0o600
    s = client.get("/settings").json()["integrations"]
    assert (s["hf"]["token"]["last4"], s["runpod"]["apiKey"]["last4"]) == ("AAAA", "CCCC")

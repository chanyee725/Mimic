"""data/settings/<part>.yaml / secrets.yaml persistence."""

import os
import stat

import yaml

from app.configs.config import config
from app.core import storage
from app.services import settings as service

PART_FILES = [
    "connection.yaml",
    "huggingface.yaml",
    "notifications.yaml",
    "runpod.yaml",
    "station.yaml",
    "storage.yaml",
    "training.yaml",
    "wandb.yaml",
]


def part(name):
    return storage.path("settings", f"{name}.yaml")


def read_part(name):
    return yaml.safe_load(part(name).read_text())


def read_file(name):
    return yaml.safe_load(storage.path(name).read_text())


def snapshot():
    """name → (mtime_ns, text) for every part file."""
    return {p.name: (p.stat().st_mtime_ns, p.read_text()) for p in storage.list_yaml("settings")}


def mark_old():
    # Push mtimes into the past so a rewrite is always visible
    for p in storage.list_yaml("settings"):
        os.utime(p, ns=(1, 1))


def keys(value):
    if isinstance(value, dict):
        return set(value) | {k for v in value.values() for k in keys(v)}
    if isinstance(value, list):
        return {k for v in value for k in keys(v)}
    return set()


def test_seed_writes_part_files():
    assert sorted(p.name for p in storage.list_yaml("settings")) == PART_FILES
    assert not storage.exists("settings.yaml")
    assert read_part("station") == {"name": "Station 01", "id": "st-01", "timezone": "Asia/Seoul"}
    hf = read_part("huggingface")
    assert hf == {
        "token": {"set": True, "last4": "3kQz"},
        "namespace": "vla-lab",
        "private_by_default": True,
    }
    assert read_part("storage")["keep_checkpoints"] == 4
    training = read_part("training")
    assert "simEnvsPath" not in training and training["sim_envs_path"]
    assert {"key", "label", "on"} <= set(read_part("notifications")["events"][0])


def test_files_have_no_version_or_live_fields():
    for p in storage.list_yaml("settings"):
        found = keys(yaml.safe_load(p.read_text()))
        assert not found & {"version", "state", "latency_ms", "spent_this_month", "operators"}, p
    assert "spent_this_month" not in read_part("runpod")
    assert read_part("connection")["api"] == {"url": "http://localhost:8000"}


def test_live_fields_come_from_seed(client):
    s = client.get("/settings").json()
    assert s["version"] == 1
    assert s["integrations"]["runpod"]["spentThisMonth"] == 142.3
    assert s["connection"]["api"] == {"url": "http://localhost:8000", "state": "ok", "latencyMs": 4}


def test_patch_rewrites_only_its_file(client):
    mark_old()
    before = snapshot()
    body = {"version": 1, "warnAtPct": 90, "keepCheckpoints": 8}
    assert client.patch("/settings/storage", json=body).status_code == 200
    after = snapshot()
    assert [n for n in PART_FILES if after[n] != before[n]] == ["storage.yaml"]
    assert read_part("storage")["keep_checkpoints"] == 8

    mark_old()
    before = snapshot()
    body = {"version": 2, "runpod": {"monthlyBudget": 500}}
    assert client.patch("/settings/integrations", json=body).status_code == 200
    after = snapshot()
    assert [n for n in PART_FILES if after[n] != before[n]] == ["runpod.yaml"]
    assert read_part("runpod")["monthly_budget"] == 500


def test_patch_persists_and_reloads(client):
    body = {"version": 1, "warnAtPct": 90, "keepCheckpoints": 8}
    assert client.patch("/settings/storage", json=body).status_code == 200
    body = {"version": 2, "events": [{"key": "sim_done", "on": True}]}
    assert client.patch("/settings/notifications", json=body).status_code == 200

    service.reset()  # data dir kept
    s = client.get("/settings").json()
    assert s["version"] == 1  # version lives in memory only
    assert (s["storage"]["warnAtPct"], s["storage"]["keepCheckpoints"]) == (90, 8)
    assert next(e for e in s["notifications"]["events"] if e["key"] == "sim_done")["on"] is True


def test_reload_does_not_rewrite_files():
    mark_old()
    before = snapshot()
    service.reset()
    assert snapshot() == before


def test_connection_test_does_not_touch_files(client):
    mark_old()
    before = snapshot()
    for target in ("hf", "wandb", "api", "grpc"):
        client.post(f"/settings/test/{target}")
    assert client.get("/settings").json()["integrations"]["wandb"]["state"] == "error"
    assert snapshot() == before


def test_hand_edited_file_loads(client):
    station = read_part("station")
    station["name"] = "Hand Bench"
    part("station").write_text(yaml.safe_dump(station, sort_keys=False))
    # A partial file: missing keys come from the seed
    part("storage").write_text("keep_checkpoints: 16\n")
    notes = read_part("notifications")
    first = notes["events"][0]
    first["on"] = not first["on"]
    part("notifications").write_text(yaml.safe_dump(notes, sort_keys=False))
    part("runpod").write_text(
        "api_key: {set: false}\nregion: eu\nvolume: v\nmonthly_budget: 1\nidle_alert_min: 2\n"
    )

    service.reset()
    s = client.get("/settings").json()
    assert (s["version"], s["station"]["name"]) == (1, "Hand Bench")
    assert (s["storage"]["keepCheckpoints"], s["storage"]["warnAtPct"]) == (16, 85)
    assert s["notifications"]["events"][0]["on"] is first["on"]
    runpod = s["integrations"]["runpod"]
    assert runpod["apiKey"] == {"set": False} and runpod["region"] == "eu"
    assert runpod["state"] == "ok"  # live field from the seed
    assert part("storage").read_text() == "keep_checkpoints: 16\n"  # not rewritten on load


def test_missing_part_file_is_reseeded(client):
    client.patch("/settings/storage", json={"version": 1, "warnAtPct": 90})
    part("station").unlink()
    service.reset()
    assert read_part("station")["name"] == "Station 01"
    assert read_part("storage")["warn_at_pct"] == 90


def test_broken_file_falls_back_untouched(client):
    for broken in ("name: [unclosed\n", "name: ''\n", "- a list\n", "timezone: Mars/Base\n"):
        part("station").write_text(broken)
        service.reset()
        assert part("station").read_text() == broken
        s = client.get("/settings").json()
        assert s["station"]["name"] == "Station 01"

        # Saving another part leaves the broken file alone
        client.patch("/settings/storage", json={"version": 1, "warnAtPct": 70})
        client.put("/settings/secrets/hf_token", json={"value": "hf_new_value_ABCD"})
        assert part("station").read_text() == broken

    # Saving the broken part itself rewrites it
    client.patch("/settings/station", json={"version": 2, "name": "Fixed"})
    assert read_part("station")["name"] == "Fixed"


def test_migrates_legacy_settings_yaml(client):
    for p in storage.list_yaml("settings"):
        p.unlink()
    storage.path("settings").rmdir()
    legacy = {
        "version": 3,
        "station": {
            "name": "Legacy",
            "id": "st-01",
            "timezone": "Asia/Seoul",
            "operators": [{"id": "OP-01", "role": "admin"}],
        },
        "integrations": {
            "hf": {"token": {"set": False}, "namespace": "old", "private_by_default": False},
            "runpod": {"bogus": "not a valid runpod part", "monthly_budget": -1},
        },
        "storage": {"warn_at_pct": 70},
        "recording": {"action_hz": 60, "chunk_mb": 4},
        "training": {"save_freq": 1234, "sim_envs_path": "sim/envs"},
    }
    storage.write("settings.yaml", legacy)

    service.reset()
    assert not storage.exists("settings.yaml")
    assert sorted(p.name for p in storage.list_yaml("settings")) == PART_FILES
    assert read_part("station") == {"name": "Legacy", "id": "st-01", "timezone": "Asia/Seoul"}
    assert read_part("huggingface")["token"] == {"set": False}
    assert read_part("runpod")["monthly_budget"] == 300.0  # invalid part → seed
    assert read_part("storage")["warn_at_pct"] == 70
    assert read_part("training")["save_freq"] == 1234
    for p in storage.list_yaml("settings"):
        assert not keys(yaml.safe_load(p.read_text())) & {"version", "state", "operators"}
    s = client.get("/settings").json()
    assert (s["version"], s["station"]["name"], s["integrations"]["hf"]["namespace"]) == (
        1,
        "Legacy",
        "old",
    )
    assert "recording" not in s


def test_legacy_file_ignored_when_folder_exists():
    storage.write("settings.yaml", {"station": {"name": "Legacy"}})
    service.reset()
    assert storage.exists("settings.yaml")
    assert read_part("station")["name"] == "Station 01"


def test_secret_put_goes_to_private_file(client):
    value = "hf_super_secret_value_WXYZ"
    mark_old()
    before = snapshot()
    assert client.put("/settings/secrets/hf_token", json={"value": value}).status_code == 200
    secrets = storage.path("secrets.yaml")
    assert stat.S_IMODE(secrets.stat().st_mode) == 0o600
    assert secrets.read_text().startswith("#")
    assert read_file("secrets.yaml") == {"hf_token": value}
    after = snapshot()
    assert [n for n in PART_FILES if after[n] != before[n]] == ["huggingface.yaml"]
    for p in storage.list_yaml("settings"):
        text = p.read_text()
        assert value not in text and "secret_value" not in text
    assert read_part("huggingface")["token"] == {"set": True, "last4": "WXYZ"}

    service.reset()
    assert service._secrets == {"hf_token": value}
    assert service.get_settings().integrations.hf.token.last4 == "WXYZ"


def test_delete_secret_removes_it(client):
    client.put("/settings/secrets/wandb_api_key", json={"value": "wandb-key-1234"})
    assert client.delete("/settings/secrets/wandb_api_key").status_code == 200
    assert "wandb_api_key" not in (read_file("secrets.yaml") or {})
    assert read_part("wandb")["api_key"] == {"set": False}
    service.reset()
    assert "wandb_api_key" not in service._secrets


def test_secrets_file_wins_over_settings_last4(client):
    storage.write_text("secrets.yaml", "runpod_api_key: rp-abcd9876\n", private=True)
    service.reset()
    key = client.get("/settings").json()["integrations"]["runpod"]["apiKey"]
    assert key == {"set": True, "last4": "9876"}
    assert read_part("runpod")["api_key"]["last4"] == "9876"


def test_persisted_sim_envs_path_applied(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "sim_envs_dir", config.sim_envs_dir)
    envs = tmp_path / "my-envs"
    training = read_part("training")
    training["sim_envs_path"] = str(envs)
    storage.write("settings/training.yaml", training)
    service.reset()
    assert config.sim_envs_dir == envs

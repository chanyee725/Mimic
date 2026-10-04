"""config/settings/<part>.yaml persistence (secrets: test_settings_secrets.py)."""

import os

import yaml

from app.core import storage
from app.services import settings as service

PART_FILES = [
    "connection.yaml",
    "huggingface.yaml",
    "notifications.yaml",
    "runpod.yaml",
]


def part(name):
    return storage.path("settings", f"{name}.yaml")


def read_part(name):
    return yaml.safe_load(part(name).read_text())


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
    assert read_part("huggingface") == {"namespace": "vla-lab", "private_by_default": True}
    assert not storage.exists("settings/storage.yaml")  # dropped: paths follow the data folder
    assert {"key", "label", "on"} <= set(read_part("notifications")["events"][0])


def test_files_have_no_version_live_fields_or_secrets():
    banned = {"version", "state", "latency_ms", "spent_this_month", "operators"}
    banned |= {"token", "api_key", "slack_webhook"}
    for p in storage.list_yaml("settings"):
        assert not keys(yaml.safe_load(p.read_text())) & banned, p
    assert "spent_this_month" not in read_part("runpod")
    assert read_part("connection")["api"] == {"url": "http://localhost:8000"}


def test_live_fields_come_from_seed(client):
    s = client.get("/settings").json()
    assert s["version"] == 1
    assert s["integrations"]["runpod"]["spentThisMonth"] is None
    assert s["connection"]["api"] == {
        "url": "http://localhost:8000",
        "state": "unknown",
        "latencyMs": None,
    }


def test_patch_rewrites_only_its_file(client):
    mark_old()
    before = snapshot()
    body = {"version": 1, "api": {"url": "http://localhost:9000"}}
    assert client.patch("/settings/connection", json=body).status_code == 200
    after = snapshot()
    assert [n for n in PART_FILES if after[n] != before[n]] == ["connection.yaml"]
    assert read_part("connection")["api"]["url"] == "http://localhost:9000"

    mark_old()
    before = snapshot()
    body = {"version": 2, "runpod": {"monthlyBudget": 500}}
    assert client.patch("/settings/integrations", json=body).status_code == 200
    after = snapshot()
    assert [n for n in PART_FILES if after[n] != before[n]] == ["runpod.yaml"]
    assert read_part("runpod")["monthly_budget"] == 500


def test_patch_persists_and_reloads(client):
    body = {"version": 1, "runpod": {"idleAlertMin": 30}}
    assert client.patch("/settings/integrations", json=body).status_code == 200
    body = {"version": 2, "events": [{"key": "sim_done", "on": True}]}
    assert client.patch("/settings/notifications", json=body).status_code == 200

    service.reset()  # data dir kept
    s = client.get("/settings").json()
    assert s["version"] == 1  # version lives in memory only
    assert s["integrations"]["runpod"]["idleAlertMin"] == 30
    assert next(e for e in s["notifications"]["events"] if e["key"] == "sim_done")["on"] is True


def test_reload_does_not_rewrite_files():
    mark_old()
    before = snapshot()
    service.reset()
    assert snapshot() == before


def test_connection_test_does_not_touch_files(client):
    mark_old()
    before = snapshot()
    for target in ("hf", "runpod", "api", "grpc"):
        client.post(f"/settings/test/{target}")
    assert client.get("/settings").json()["integrations"]["runpod"]["state"] == "error"
    assert snapshot() == before


def test_hand_edited_file_loads(client):
    hf = read_part("huggingface")
    hf["namespace"] = "hand-lab"
    part("huggingface").write_text(yaml.safe_dump(hf, sort_keys=False))
    # A partial file: missing keys come from the seed
    part("connection").write_text("grpc:\n  url: localhost:6000\n")
    notes = read_part("notifications")
    first = notes["events"][0]
    first["on"] = not first["on"]
    part("notifications").write_text(yaml.safe_dump(notes, sort_keys=False))
    part("runpod").write_text("region: eu\nvolume: v\nmonthly_budget: 1\nidle_alert_min: 2\n")

    service.reset()
    s = client.get("/settings").json()
    assert (s["version"], s["integrations"]["hf"]["namespace"]) == (1, "hand-lab")
    conn = s["connection"]
    assert (conn["grpc"]["url"], conn["api"]["url"]) == ("localhost:6000", "http://localhost:8000")
    assert s["notifications"]["events"][0]["on"] is first["on"]
    runpod = s["integrations"]["runpod"]
    assert runpod["apiKey"] == {"set": False} and runpod["region"] == "eu"
    assert runpod["state"] == "unknown"  # live field from the seed
    # Not rewritten on load
    assert part("connection").read_text() == "grpc:\n  url: localhost:6000\n"


def test_missing_part_file_is_reseeded(client):
    client.patch("/settings/integrations", json={"version": 1, "runpod": {"idleAlertMin": 30}})
    part("huggingface").unlink()
    service.reset()
    assert read_part("huggingface")["namespace"] == "vla-lab"
    assert read_part("runpod")["idle_alert_min"] == 30


def test_broken_file_falls_back_untouched(client):
    for broken in ("api: [unclosed\n", "api: {url: ''}\n", "- a list\n", "grpc: 3\n"):
        part("connection").write_text(broken)
        service.reset()
        assert part("connection").read_text() == broken
        s = client.get("/settings").json()
        assert s["connection"]["api"]["url"] == "http://localhost:8000"

        # Saving another part leaves the broken file alone
        client.patch("/settings/integrations", json={"version": 1, "hf": {"namespace": "x"}})
        client.put("/settings/secrets/hf_token", json={"value": "hf_new_value_ABCD"})
        assert part("connection").read_text() == broken

    # Saving the broken part itself rewrites it
    body = {"version": 2, "api": {"url": "http://fixed:8000"}}
    client.patch("/settings/connection", json=body)
    assert read_part("connection")["api"]["url"] == "http://fixed:8000"


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
    assert read_part("huggingface") == {"namespace": "old", "private_by_default": False}
    assert read_part("runpod")["monthly_budget"] == 300.0  # invalid part → seed
    assert not storage.exists("settings/storage.yaml")
    for p in storage.list_yaml("settings"):
        assert not keys(yaml.safe_load(p.read_text())) & {"version", "state", "operators", "token"}
    s = client.get("/settings").json()
    assert (s["version"], s["integrations"]["hf"]["namespace"]) == (1, "old")
    assert not {"recording", "station", "training"} & set(s)


def test_legacy_file_ignored_when_folder_exists():
    storage.write("settings.yaml", {"integrations": {"hf": {"namespace": "old"}}})
    service.reset()
    assert storage.exists("settings.yaml")
    assert read_part("huggingface")["namespace"] == "vla-lab"


def test_obsolete_part_files_are_removed():
    storage.write("settings/station.yaml", {"name": "Old", "id": "st-01"})
    storage.write("settings/training.yaml", {"sim_envs_path": "/elsewhere"})
    storage.write("settings/storage.yaml", {"raw_path": "data/recordings", "warn_at_pct": 85})
    service.reset()
    assert sorted(p.name for p in storage.list_yaml("settings")) == PART_FILES


def test_old_secret_keys_are_cleaned_from_files(client):
    part("huggingface").write_text(
        "token: {set: true, last4: 3kQz}\nnamespace: vla-lab\nprivate_by_default: true\n"
    )
    service.reset()
    assert read_part("huggingface") == {"namespace": "vla-lab", "private_by_default": True}
    # The file's {set, last4} is ignored: no secret is configured
    assert client.get("/settings").json()["integrations"]["hf"]["token"] == {"set": False}

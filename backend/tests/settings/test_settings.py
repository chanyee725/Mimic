import platform
import shutil

import pytest

from app.configs.config import config


def get(client):
    return client.get("/settings").json()


def test_get_settings(client):
    s = get(client)
    assert s["version"] == 1
    # Tests run with an empty .env and no secret env vars
    assert s["integrations"]["hf"]["token"] == {"set": False}
    assert set(s) == {"version", "integrations", "connection", "notifications"}
    # Live values are unknown until a connection test runs
    assert s["integrations"]["hf"]["state"] == "unknown"
    assert s["integrations"]["runpod"] == {"apiKey": {"set": False}, "state": "unknown"}
    assert list(s["connection"]) == ["isaac"]
    assert s["connection"]["isaac"]["state"] == "unknown"
    keys = [e["key"] for e in s["notifications"]["events"]]
    assert keys == ["train_done", "train_failed", "disk"]


def test_patch_section(client):
    body = {"version": 1, "port": 5, "isaac": {"port": 8300}}
    r = client.patch("/settings/connection", json=body)
    assert r.status_code == 200
    s = r.json()
    assert s["version"] == 2
    assert s["connection"]["isaac"]["port"] == 8300
    assert get(client)["version"] == 2


def test_patch_ignores_read_only_and_unknown(client):
    client.put("/settings/secrets/hf_token", json={"value": "hf_value_3kQz"})
    client.post("/settings/test/hf")
    body = {
        "version": 1,
        "hf": {"namespace": "lab", "state": "error", "token": {"set": False}},
        "runpod": {"monthlyBudget": 500},
        "bogus": 1,
    }
    s = client.patch("/settings/integrations", json=body).json()
    assert s["integrations"]["hf"]["namespace"] == "lab"
    assert s["integrations"]["hf"]["state"] == "ok"
    assert s["integrations"]["hf"]["token"]["set"] is True
    assert "monthlyBudget" not in s["integrations"]["runpod"]


def test_patch_notification_events(client):
    body = {"version": 1, "events": [{"key": "disk", "on": False, "label": "renamed"}]}
    events = client.patch("/settings/notifications", json=body).json()["notifications"]["events"]
    disk = next(e for e in events if e["key"] == "disk")
    assert disk["on"] is False and disk["label"] == "Disk almost full"
    body = {"version": 2, "events": [{"key": "nope", "on": True}]}
    assert client.patch("/settings/notifications", json=body).status_code == 422


def test_patch_stale_version(client):
    client.patch("/settings/integrations", json={"version": 1, "hf": {"namespace": "a"}})
    r = client.patch("/settings/integrations", json={"version": 1, "hf": {"namespace": "b"}})
    assert r.status_code == 409
    assert r.json()["error"]["details"]["current"]["integrations"]["hf"]["namespace"] == "a"


@pytest.mark.parametrize(
    "section,body",
    [
        ("connection", {"isaac": {"port": 0}}),
        ("connection", {"isaac": {"mode": "remote", "url": ""}}),
        ("integrations", {"hf": {"privateByDefault": "maybe"}}),
    ],
)
def test_patch_validation(client, section, body):
    r = client.patch(f"/settings/{section}", json={"version": 1, **body})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_error"
    assert get(client)["version"] == 1


def test_patch_bad_request(client):
    assert client.patch("/settings/integrations", json={"hf": {}}).status_code == 422
    assert client.patch("/settings/nope", json={"version": 1}).status_code == 422


@pytest.mark.parametrize("section", ["recording", "station", "training", "storage"])
def test_removed_sections(client, section):
    # Dropped sections are treated like any unknown section
    r = client.patch(f"/settings/{section}", json={"version": 1, "name": "x"})
    assert r.status_code == 422
    assert section not in get(client)


def test_secrets_write_only(client):
    r = client.put("/settings/secrets/runpod_api_key", json={"value": "rp-secret-9XyZ"})
    assert r.status_code == 200 and r.json() == {"set": True, "last4": "9XyZ"}
    s = get(client)
    assert s["integrations"]["runpod"]["apiKey"] == {"set": True, "last4": "9XyZ"}
    assert "rp-secret" not in client.get("/settings").text
    assert s["version"] == 1


def test_delete_secret(client):
    r = client.delete("/settings/secrets/hf_token")
    assert r.status_code == 200 and r.json() == {"set": False}
    hf = get(client)["integrations"]["hf"]
    assert hf["token"] == {"set": False} and hf["state"] == "unknown"


def test_secret_errors(client):
    assert client.put("/settings/secrets/hf_token", json={"value": "short"}).status_code == 422
    assert client.put("/settings/secrets/nope", json={"value": "longenough"}).status_code == 422


def test_connection_tests(client):
    assert client.post("/settings/test/hf").json()["state"] == "error"
    client.put("/settings/secrets/hf_token", json={"value": "hf_value_3kQz"})
    assert client.post("/settings/test/hf").json()["state"] == "ok"
    r = client.post("/settings/test/runpod").json()
    assert r["state"] == "error" and "detail" in r
    assert get(client)["integrations"]["runpod"]["state"] == "error"
    client.put("/settings/secrets/slack_webhook", json={"value": "https://hooks.example/abcd"})
    assert client.post("/settings/test/slack").json()["state"] == "ok"
    assert client.post("/settings/test/nope").status_code == 422
    # Removed targets
    for target in ("api", "grpc", "webrtc"):
        assert client.post(f"/settings/test/{target}").status_code == 422


def test_disk_is_real(client):
    (config.recordings_dir / "task").mkdir(parents=True)
    (config.recordings_dir / "task" / "ep.mcap").write_bytes(b"x" * 3_000_000)
    config.models_dir.mkdir(parents=True)
    (config.models_dir / "w.bin").write_bytes(b"x" * 1_000_000)
    disk = client.get("/settings/disk").json()
    usage = shutil.disk_usage(config.data_dir)
    assert disk["totalGB"] == round(usage.total / 1024**3, 3)
    parts = {p["key"]: p for p in disk["parts"]}
    assert list(parts) == ["raw", "datasets", "models", "other"]
    assert parts["raw"]["gb"] == round(3_000_000 / 1024**3, 3)
    assert parts["datasets"]["gb"] == 0
    assert parts["models"]["gb"] == round(1_000_000 / 1024**3, 3)
    assert 0 <= parts["other"]["gb"] <= disk["totalGB"]


def test_shortcuts(client):
    assert client.get("/settings/shortcuts").json()[0]["page"] == "Capture"


def test_versions_are_real(client):
    rows = {r["k"]: r["v"] for r in client.get("/settings/versions").json()}
    assert list(rows) == ["Python", "FastAPI", "Pydantic", "mcap", "lerobot"]
    assert rows["Python"] == platform.python_version()
    import fastapi
    import pydantic

    assert rows["FastAPI"] == fastapi.__version__ and rows["Pydantic"] == pydantic.VERSION
    assert rows["lerobot"]  # a version, or "not installed"

import pytest


def get(client):
    return client.get("/settings").json()


def test_get_settings(client):
    s = get(client)
    assert s["version"] == 1
    # Tests run with an empty .env and no secret env vars
    assert s["integrations"]["hf"]["token"] == {"set": False}
    assert s["storage"]["keepCheckpoints"] == 4
    assert set(s) == {"version", "integrations", "storage", "connection", "notifications"}


def test_patch_section(client):
    body = {"version": 1, "warn_at_pct": 90, "keepCheckpoints": 8}
    r = client.patch("/settings/storage", json=body)
    assert r.status_code == 200
    s = r.json()
    assert s["version"] == 2
    assert (s["storage"]["warnAtPct"], s["storage"]["keepCheckpoints"]) == (90, 8)
    assert get(client)["version"] == 2


def test_patch_ignores_read_only_and_unknown(client):
    client.put("/settings/secrets/hf_token", json={"value": "hf_value_3kQz"})
    client.post("/settings/test/hf")
    body = {
        "version": 1,
        "hf": {"namespace": "lab", "state": "error", "token": {"set": False}},
        "runpod": {"spentThisMonth": 0, "monthlyBudget": 500},
        "bogus": 1,
    }
    s = client.patch("/settings/integrations", json=body).json()
    assert s["integrations"]["hf"]["namespace"] == "lab"
    assert s["integrations"]["hf"]["state"] == "ok"
    assert s["integrations"]["hf"]["token"]["set"] is True
    assert s["integrations"]["runpod"]["spentThisMonth"] == 142.3
    assert s["integrations"]["runpod"]["monthlyBudget"] == 500


def test_patch_notification_events(client):
    body = {"version": 1, "events": [{"key": "sim_done", "on": True, "label": "renamed"}]}
    events = client.patch("/settings/notifications", json=body).json()["notifications"]["events"]
    sim = next(e for e in events if e["key"] == "sim_done")
    assert sim["on"] is True and sim["label"] == "Simulation evaluation finished"
    body = {"version": 2, "events": [{"key": "nope", "on": True}]}
    assert client.patch("/settings/notifications", json=body).status_code == 422


def test_patch_stale_version(client):
    client.patch("/settings/storage", json={"version": 1, "warnAtPct": 90})
    r = client.patch("/settings/storage", json={"version": 1, "warnAtPct": 80})
    assert r.status_code == 409
    assert r.json()["error"]["details"]["current"]["storage"]["warnAtPct"] == 90


@pytest.mark.parametrize(
    "section,body",
    [
        ("storage", {"warnAtPct": 0}),
        ("storage", {"keepCheckpoints": 0}),
        ("storage", {"rawPath": ""}),
        ("integrations", {"runpod": {"monthlyBudget": -1}}),
    ],
)
def test_patch_validation(client, section, body):
    r = client.patch(f"/settings/{section}", json={"version": 1, **body})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_error"
    assert get(client)["version"] == 1


def test_patch_bad_request(client):
    assert client.patch("/settings/storage", json={"warnAtPct": 20}).status_code == 422
    assert client.patch("/settings/nope", json={"version": 1}).status_code == 422


@pytest.mark.parametrize("section", ["recording", "station", "training"])
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
    assert client.post("/settings/test/api").json()["state"] == "ok"
    assert client.post("/settings/test/hf").json()["state"] == "error"
    client.put("/settings/secrets/hf_token", json={"value": "hf_value_3kQz"})
    assert client.post("/settings/test/hf").json()["state"] == "ok"
    r = client.post("/settings/test/runpod").json()
    assert r["state"] == "error" and "detail" in r
    assert get(client)["integrations"]["runpod"]["state"] == "error"
    client.put("/settings/secrets/slack_webhook", json={"value": "https://hooks.example/abcd"})
    assert client.post("/settings/test/slack").json()["state"] == "ok"
    assert client.post("/settings/test/nope").status_code == 422


def test_disk_shortcuts_versions(client):
    disk = client.get("/settings/disk").json()
    assert disk["totalGB"] == 2000 and [p["key"] for p in disk["parts"]][0] == "raw"
    assert client.get("/settings/shortcuts").json()[0]["page"] == "Capture"
    assert {"k": "Isaac Sim", "v": "4.5"} in client.get("/settings/versions").json()

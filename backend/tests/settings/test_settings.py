import pytest


def get(client):
    return client.get("/settings").json()


def test_get_settings(client):
    s = get(client)
    assert s["version"] == 1
    assert s["integrations"]["hf"]["token"] == {"set": True, "last4": "3kQz"}
    assert s["recording"]["chunkMB"] == 4


def test_patch_section(client):
    r = client.patch("/settings/recording", json={"version": 1, "crf": 24, "chunk_mb": 8})
    assert r.status_code == 200
    s = r.json()
    assert s["version"] == 2
    assert (s["recording"]["crf"], s["recording"]["chunkMB"]) == (24, 8)
    assert get(client)["version"] == 2


def test_patch_ignores_read_only_and_unknown(client):
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
    s = client.patch("/settings/station", json={"version": 2, "id": "x", "name": "Bench"}).json()
    assert (s["station"]["id"], s["station"]["name"]) == ("st-01", "Bench")


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
        ("recording", {"crf": 99}),
        ("recording", {"codec": "vp9"}),
        ("storage", {"warnAtPct": 0}),
        ("station", {"operators": [{"id": "OP-1", "role": "admin"}]}),
        ("station", {"operators": [{"id": "OP-01", "role": "operator"}]}),
        ("station", {"operators": [{"id": "OP-01", "role": "admin"}] * 2}),
        ("station", {"timezone": "Mars/Base"}),
        ("training", {"defaultCompute": "cloud"}),
    ],
)
def test_patch_validation(client, section, body):
    r = client.patch(f"/settings/{section}", json={"version": 1, **body})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_error"
    assert get(client)["version"] == 1


def test_patch_bad_request(client):
    assert client.patch("/settings/recording", json={"crf": 20}).status_code == 422
    assert client.patch("/settings/nope", json={"version": 1}).status_code == 422


def test_secrets_write_only(client):
    r = client.put("/settings/secrets/wandb_api_key", json={"value": "wb-secret-9XyZ"})
    assert r.status_code == 200 and r.json() == {"set": True, "last4": "9XyZ"}
    s = get(client)
    assert s["integrations"]["wandb"]["apiKey"] == {"set": True, "last4": "9XyZ"}
    assert "wb-secret" not in client.get("/settings").text
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
    assert client.post("/settings/test/hf").json()["state"] == "ok"
    r = client.post("/settings/test/wandb").json()
    assert r["state"] == "error" and "detail" in r
    assert get(client)["integrations"]["wandb"]["state"] == "error"
    client.put("/settings/secrets/slack_webhook", json={"value": "https://hooks.example/abcd"})
    assert client.post("/settings/test/slack").json()["state"] == "ok"
    assert client.post("/settings/test/nope").status_code == 422


def test_disk_shortcuts_versions(client):
    disk = client.get("/settings/disk").json()
    assert disk["totalGB"] == 2000 and [p["key"] for p in disk["parts"]][0] == "raw"
    assert client.get("/settings/shortcuts").json()[0]["page"] == "Capture"
    assert {"k": "Isaac Sim", "v": "4.5"} in client.get("/settings/versions").json()

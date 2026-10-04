"""Models: folders under config.models_dir with a model.yaml each."""

import yaml

from app.configs.config import config
from app.services import models
from tests.support import write_model


def test_starts_empty(client):
    assert client.get("/models").json() == []
    assert client.get("/models/nope").status_code == 404


def test_folders_are_indexed(client):
    d = write_model("m-a", saved_at="2026-10-01T12:00:00+09:00")
    write_model("m-b", task_id="open-drawer", saved_at="2026-10-02T12:00:00+09:00")
    (config.models_dir / "no-sidecar").mkdir()
    (config.models_dir / "broken").mkdir()
    (config.models_dir / "broken" / "model.yaml").write_text("name: [unclosed\n")
    models.reset()
    rows = client.get("/models").json()
    assert [m["id"] for m in rows] == ["m-b", "m-a"]
    a = rows[1]
    assert a["name"] == "Model m-a" and a["taskId"] == "stack-two-blocks"
    assert a["localPath"] == str(d) and a["sizeMB"] == 2.0 and a["hubRepo"] is None
    assert [m["id"] for m in client.get("/models", params={"taskId": "open-drawer"}).json()] == [
        "m-b"
    ]
    assert client.get("/models", params={"location": "hub"}).json() == []


def test_rename_persists(client):
    d = write_model("m-a")
    r = client.patch("/models/m-a", json={"name": "  Stack v2 "})
    assert r.status_code == 200 and r.json()["name"] == "Stack v2"
    assert yaml.safe_load((d / "model.yaml").read_text())["name"] == "Stack v2"
    models.reset()
    assert client.get("/models/m-a").json()["name"] == "Stack v2"
    assert client.patch("/models/m-a", json={"name": ""}).status_code == 422


def test_delete_removes_folder(client):
    d = write_model("m-a")
    assert client.delete("/models/m-a").status_code == 204
    assert not d.exists()
    assert client.get("/models/m-a").status_code == 404
    assert client.delete("/models/m-a").status_code == 404


def test_files(client):
    write_model("m-a")
    files = client.get("/models/m-a/files").json()
    assert files == [
        {"path": "pretrained_model/config.json", "sizeMB": 0.0},
        {"path": "pretrained_model/model.safetensors", "sizeMB": 2.0},
    ]


def test_download_not_implemented(client):
    write_model("m-a")
    assert client.get("/models/m-a/download").status_code == 501


def test_push(client, monkeypatch):
    d = write_model("m-a")
    assert client.post("/models/m-a/push").status_code == 424
    monkeypatch.setattr(models, "secret_set", lambda name: True)
    r = client.post("/models/m-a/push", json={"repo": "lab/smolvla_stack"})
    assert r.status_code == 202 and r.json()["hubRepo"] == "lab/smolvla_stack"
    assert yaml.safe_load((d / "model.yaml").read_text())["hub_repo"] == "lab/smolvla_stack"


def test_record_trial_groups_by_instruction():
    d = write_model("m-a")
    models.record_trial("m-a", "stack", True, "2000-01-01T00:00:00+09:00")
    models.record_trial("m-a", "stack", False, "2000-01-01T00:00:00+09:00")
    e = models.record_trial("m-a", "other", True, "2000-01-01T00:00:00+09:00")
    assert e.trials == 1
    evals = yaml.safe_load((d / "model.yaml").read_text())["evals"]
    assert [(x["instruction"], x["trials"], x["success"]) for x in evals] == [
        ("stack", 2, 1),
        ("other", 1, 1),
    ]

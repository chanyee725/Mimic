from app.services import models as service


def test_list_newest_first(client):
    items = client.get("/models").json()
    assert [m["id"] for m in items][0] == "m-stack-10k"
    assert items[0]["sizeMB"] == 1850
    dates = [m["savedAt"] for m in items]
    assert dates == sorted(dates, reverse=True)


def test_list_filters(client):
    drawer = client.get("/models", params={"taskId": "open-drawer"}).json()
    assert {m["taskId"] for m in drawer} == {"open-drawer"}
    hub = client.get("/models", params={"location": "hub"}).json()
    assert [m["id"] for m in hub] == ["m-open-drawer-20k"]
    assert client.get("/models", params={"location": "cloud"}).status_code == 422


def test_get_and_404(client):
    assert client.get("/models/m-stack-20k").json()["jobId"] == "job_033"
    r = client.get("/models/nope")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"


def test_rename(client):
    r = client.patch("/models/m-stack-20k", json={"name": "  stack v1 final "})
    assert r.status_code == 200
    assert r.json()["name"] == "stack v1 final"
    assert client.patch("/models/m-stack-20k", json={"name": ""}).status_code == 422
    assert client.patch("/models/nope", json={"name": "x"}).status_code == 404


def test_delete(client):
    assert client.delete("/models/m-stack-20k").status_code == 204
    assert client.get("/models/m-stack-20k").status_code == 404
    assert client.delete("/models/m-stack-20k").status_code == 404


def test_files(client):
    files = client.get("/models/m-stack-20k/files").json()
    assert files[0] == {"path": "pretrained_model/model.safetensors", "sizeMB": 1790}
    assert client.get("/models/nope/files").status_code == 404


def test_download_not_implemented(client):
    r = client.get("/models/m-stack-20k/download")
    assert r.status_code == 501
    assert r.json()["error"]["code"] == "not_implemented"


def test_push(client):
    client.put("/settings/secrets/hf_token", json={"value": "hf_test_token"})
    r = client.post("/models/m-stack-20k/push", json={})
    assert r.status_code == 202
    assert r.json()["hubRepo"] == "vla-lab/smolvla_stack_two_blocks"
    r = client.post("/models/m-stack-10k/push", json={"repo": "vla-lab/custom", "private": True})
    assert r.json()["hubRepo"] == "vla-lab/custom"
    assert client.post("/models/nope/push", json={}).status_code == 404


def test_push_without_token(client, monkeypatch):
    monkeypatch.setattr(service, "secret_set", lambda name: False)
    r = client.post("/models/m-stack-20k/push", json={})
    assert r.status_code == 424
    assert r.json()["error"]["code"] == "dependency_failed"


def test_record_trial_groups_by_instruction():
    start = "2000-01-01T00:00:00+09:00"
    before = len(service.get_model("m-stack-20k").evals)
    service.record_trial("m-stack-20k", "stack it", True, start)
    e = service.record_trial("m-stack-20k", "stack it", False, start)
    service.record_trial("m-stack-20k", "other", True, start)
    assert (e.trials, e.success) == (2, 1)
    assert len(service.get_model("m-stack-20k").evals) == before + 2

"""Simulation jobs: validated, then refused until the Isaac Sim runner is connected."""

import pytest

from app.utils import gpu
from tests.support import write_model

NEW = {
    "modelId": "m-stack",
    "envId": "clutter-stress",
    "episodes": 5,
    "seedStart": 500,
    "maxSeconds": 30,
    "randomization": "high",
}


@pytest.fixture(autouse=True)
def model(task):
    write_model("m-stack")


def test_jobs_empty(client):
    assert client.get("/sim/jobs").json() == []
    assert client.get("/sim/jobs", params={"status": "done"}).json() == []
    assert client.get("/sim/jobs", params={"status": "bogus"}).status_code == 422
    r = client.get("/sim/jobs/sim_001")
    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"
    assert client.post("/sim/jobs/sim_001/stop").status_code == 404
    assert client.get("/sim/jobs/sim_001/episodes").status_code == 404
    assert client.get("/sim/jobs/sim_001/episodes/0/video/top").status_code == 404


def test_create_needs_the_runner(client, events):
    for env in ("clutter-stress", "sort-by-color"):  # sort-by-color only has a warning
        r = client.post("/sim/jobs", json={**NEW, "envId": env})
        assert r.status_code == 503
        assert r.json()["error"]["message"] == "Isaac Sim runner is not connected"
    assert client.get("/sim/jobs").json() == []
    assert not [m for m in events() if m["type"] == "sim.updated"]


def test_create_incompatible(client):
    r = client.post("/sim/jobs", json={**NEW, "envId": "top-only-demo"})
    assert r.status_code == 422
    err = r.json()["error"]
    assert err["code"] == "validation_error"
    assert err["details"]["issues"] == [{"level": "error", "text": "Missing camera wrist"}]
    r = client.post("/sim/jobs", json={**NEW, "envId": "pour-into-cup"})
    assert r.status_code == 422 and r.json()["error"]["details"]["issues"][0]["level"] == "error"


def test_create_unknown_ids(client):
    r = client.post("/sim/jobs", json={**NEW, "modelId": "m-nope"})
    assert r.status_code == 422 and "m-nope" in r.json()["error"]["message"]
    r = client.post("/sim/jobs", json={**NEW, "envId": "nope"})
    assert r.status_code == 422 and "nope" in r.json()["error"]["message"]


def test_create_bad_body(client):
    r = client.post("/sim/jobs", json={**NEW, "episodes": 0})
    assert r.status_code == 422 and r.json()["error"]["details"]["errors"]
    assert client.post("/sim/jobs", json={**NEW, "randomization": "max"}).status_code == 422


def test_config_gpu(client, envs_dir, monkeypatch):
    monkeypatch.setattr(
        gpu, "detect", lambda: (gpu.Gpu(id="cuda:0", name="NVIDIA GeForce RTX 4090", vram="24 GB"),)
    )
    cfg = client.get("/sim/config").json()
    assert cfg["envsDir"] == str(envs_dir)
    assert cfg["gpu"] == {
        "id": "cuda:0",
        "name": "NVIDIA GeForce RTX 4090",
        "vram": "24 GB",
        "busyBy": None,
    }
    monkeypatch.setattr(gpu, "detect", lambda: ())
    assert client.get("/sim/config").json()["gpu"] is None

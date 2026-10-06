import socket
import sys
import time
from pathlib import Path

import pytest

from app.services import settings
from app.services.simulation import runner

FAKE_APP = Path(__file__).parent / "fake_isaac_app.py"


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _isaac(**values) -> None:
    current = settings.get_settings()
    settings.patch_section("connection", {"version": current.version, "isaac": values})


@pytest.fixture
def local_server(tmp_path, monkeypatch):
    """Local mode on a free port with the fake app; the started server is stopped afterwards."""
    monkeypatch.setattr(runner, "APP_SCRIPT", FAKE_APP)
    monkeypatch.setattr(runner, "CACHE_DIR", tmp_path / "sim-cache")
    _isaac(mode="local", display="headless", python=sys.executable, port=_free_port())
    yield
    runner.stop_local_server()


def _wait_app(client, state: str, timeout: float = 15.0) -> dict:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        body = client.get("/sim/runner").json()
        if (
            body["app"]
            and body["app"]["state"] == state
            and (state != "running" or body["app"]["scene"])
        ):
            return body
        time.sleep(0.2)
    raise AssertionError(f"app did not reach {state}: {body}")


def test_status_without_server(client):
    _isaac(mode="local", port=_free_port())
    body = client.get("/sim/runner").json()
    assert body["mode"] == "local" and body["display"] == "window"
    assert body["reachable"] is False and body["app"] is None


@pytest.mark.usefixtures("local_server")
def test_open_env_starts_server_and_app(client):
    r = client.post("/sim/envs/drawer/open")
    assert r.status_code == 200, r.text
    assert r.json()["reachable"] is True
    body = _wait_app(client, "running")
    assert body["app"]["scene"] == "drawer" and body["app"]["display"] == "headless"
    # A top-level stage file is sent alone and opened by its name
    assert client.post("/sim/envs/kitchen/open").status_code == 200
    deadline = time.monotonic() + 15
    while client.get("/sim/runner").json()["app"]["scene"] != "kitchen":
        assert time.monotonic() < deadline, "kitchen did not open"
        time.sleep(0.2)

    assert client.post("/sim/runner/stop").json()["app"]["state"] == "stopped"


@pytest.mark.usefixtures("local_server")
def test_start_and_display_switch(client):
    assert client.post("/sim/runner/start").json()["app"]["display"] == "headless"
    body = client.post("/sim/runner/start", json={"display": "window"}).json()
    assert body["app"]["display"] == "window"
    client.post("/sim/runner/stop")


@pytest.mark.usefixtures("local_server")
def test_settings_test_reports_the_server(client):
    assert client.post("/settings/test/isaac").json()["state"] == "ok"  # installed, not running
    client.post("/sim/runner/start")
    r = client.post("/settings/test/isaac").json()
    assert r["state"] == "ok" and r["latencyMs"] is not None
    assert settings.get_settings().connection.isaac.state == "ok"
    client.post("/sim/runner/stop")


def test_unknown_env_is_not_opened(client):
    assert client.post("/sim/envs/nope/open").status_code == 404


def test_missing_python_and_remote_errors(client):
    _isaac(mode="local", python="/nonexistent/python", port=_free_port())
    r = client.post("/sim/runner/start")
    assert r.status_code == 503 and "not found" in r.json()["error"]["message"]
    assert client.post("/settings/test/isaac").json()["state"] == "error"

    _isaac(mode="remote", url=f"http://127.0.0.1:{_free_port()}")
    assert client.post("/sim/envs/table/open").status_code == 503
    assert client.get("/sim/runner").json()["reachable"] is False


def test_remote_needs_url(client):
    r = client.patch(
        "/settings/connection",
        json={"version": settings.get_settings().version, "isaac": {"mode": "remote", "url": ""}},
    )
    assert r.status_code == 422

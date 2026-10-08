import io
import socket
import sys
import tarfile
import time
from pathlib import Path

import pytest

from app.configs.config import config
from app.services import settings
from app.services.simulation import runner
from tests.support import write_sim_robots, write_sim_tool

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
    # A top-level script is sent alone and built by its name
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


def test_archive_carries_the_tagged_robot(envs_dir):
    write_sim_robots("arm", "other")
    archive = runner._archive(envs_dir / "drawer", config.sim_robots_dir / "arm.usda")
    names = tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz").getnames()
    assert "robots/arm.usda" in names and "robots/other.usda" not in names
    assert all(n.startswith(("envs/drawer/", "robots/")) for n in names)


def test_open_needs_the_tagged_robot_usd(client):
    write_sim_robots("arm")
    client.patch("/sim/envs/table", json={"robots": ["arm"]})
    (config.sim_robots_dir / "arm.usda").unlink()
    r = client.post("/sim/envs/table/open")
    assert r.status_code == 422 and "has no USD" in r.json()["error"]["message"]


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


def test_physics_device_defaults_to_gpu_and_restarts_on_change(client, local_server):
    body = client.post("/sim/runner/start").json()
    assert body["device"] == "gpu" and body["app"]["device"] == "gpu"
    pid = body["app"]["pid"]
    _isaac(device="cpu")
    body = client.post("/sim/runner/start").json()
    assert body["device"] == "cpu" and body["app"]["device"] == "cpu"
    assert body["app"]["pid"] != pid  # the app takes the device at launch


def test_archive_of_a_tool_alone_carries_its_folder_and_script(envs_dir):
    write_sim_tool("hand")
    usd = config.sim_tools_dir / "hand" / "hand.usda"
    archive = runner._archive(None, usd, "def build(scene):\n    pass\n")
    tar = tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz")
    assert sorted(tar.getnames()) == [
        "preview.py",
        "tools/hand/hand.usda",
        "tools/hand/payloads/base.usda",
    ]
    assert b"def build" in tar.extractfile("preview.py").read()


def test_archive_follows_relative_references_to_other_assets(envs_dir):
    # A robot composed of an arm and a hand references both folders by relative path
    write_sim_tool("hand")
    arm = config.sim_robots_dir / "arm" / "arm.usda"
    (arm.parent / "parts").mkdir(parents=True)
    arm.write_text('#usda 1.0\ndef "a" (references = @./parts/link.usda@) {}\n')
    (arm.parent / "parts" / "link.usda").write_text("#usda 1.0\n")
    combo = config.sim_robots_dir / "combo" / "combo.usda"
    combo.parent.mkdir(parents=True)
    combo.write_text(
        "#usda 1.0\n"
        'def "r" (references = @../arm/arm.usda@) {\n'
        '  def "t" (references = @../../tools/hand/hand.usda@) {}\n'
        '  def "u" (references = @../arm/arm.usda@) {}\n'
        '  def "x" (references = @../../../outside.usda@) {}\n'
        '  def "y" (references = @../missing/missing.usda@) {}\n'
        "}\n"
    )
    (config.sim_dir.parent / "outside.usda").write_text("#usda 1.0\n")
    # The tool points back at the arm: no duplicate
    hand = config.sim_tools_dir / "hand" / "hand.usda"
    hand.write_text('#usda 1.0\ndef "h" (references = @../../robots/arm/arm.usda@) {}\n')
    write_sim_robots("other")

    archive = runner._archive(None, combo, "def build(scene):\n    scene.robot()\n")
    names = tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz").getnames()
    assert sorted(names) == [
        "preview.py",
        "robots/arm/arm.usda",
        "robots/arm/parts/link.usda",
        "robots/combo/combo.usda",
        "tools/hand/hand.usda",
        "tools/hand/payloads/base.usda",
    ]


@pytest.mark.usefixtures("local_server")
def test_open_robot_and_tool_alone(client):
    write_sim_robots("arm")
    write_sim_tool("hand")
    assert client.post("/sim/robots/arm/open").status_code == 200
    assert _wait_app(client, "running")["app"]["scene"] == "robot-arm"
    assert client.post("/sim/tools/hand/open").status_code == 200
    deadline = time.monotonic() + 15
    while client.get("/sim/runner").json()["app"]["scene"] != "tool-hand":
        assert time.monotonic() < deadline, "the tool did not open"
        time.sleep(0.2)
    client.post("/sim/runner/stop")


def test_unknown_robot_or_tool_is_not_opened(client):
    assert client.post("/sim/robots/nope/open").status_code == 404
    assert client.post("/sim/tools/nope/open").status_code == 404


def test_an_outdated_local_server_is_restarted(client, local_server, monkeypatch):
    client.post("/sim/runner/start")
    [old] = runner._local_server_pids(settings.get_settings().connection.isaac.port)
    monkeypatch.setattr(runner, "JOINTS_VERSION", 99)
    client.post("/sim/runner/start")
    [new] = runner._local_server_pids(settings.get_settings().connection.isaac.port)
    assert new != old and client.get("/sim/runner").json()["reachable"]
    monkeypatch.setattr(runner, "JOINTS_VERSION", 4)
    client.post("/sim/runner/stop")

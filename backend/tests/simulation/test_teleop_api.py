import time

import pytest

from app.services import rigs
from app.services.rigs import driver, ports
from tests.simulation.test_runner_api import local_server  # noqa: F401 (fixture)
from tests.support import FakeDriver, write_sim_robots


@pytest.fixture
def fake(tmp_path, monkeypatch, envs_dir):
    d = FakeDriver(tmp_path / "calibration")
    d.calibration_dir.mkdir()
    monkeypatch.setattr(ports, "exists", lambda p: True)
    driver.use(d)
    rigs.reset()
    write_sim_robots("so101_follower", "arm")
    yield d
    driver.use(None)
    rigs.reset()


def _wait(client, ok, timeout: float = 15.0) -> dict | None:
    deadline = time.monotonic() + timeout
    while True:
        body = client.get("/sim/teleop").json()
        if ok(body):
            return body
        assert time.monotonic() < deadline, f"teleoperation state: {body}"
        time.sleep(0.1)


def test_robots_list_the_leaders_that_drive_them(client, fake):
    robots = {r["id"]: r["teleop"] for r in client.get("/sim/robots").json()}
    assert robots == {"arm": [], "so101_follower": ["so101_leader"]}


@pytest.mark.usefixtures("local_server")
def test_leader_drives_the_robot_in_isaac_sim(client, fake):
    assert client.get("/sim/teleop").json() is None
    r = client.post("/sim/teleop", json={"robotId": "so101_follower", "deviceId": "leader"})
    assert r.status_code == 201, r.text
    assert r.json()["state"] == "starting" and r.json()["targetHz"] == 30

    body = _wait(client, lambda b: b["state"] == "running" and b["joints"][0]["value"] is not None)
    assert body["error"] is None
    assert {j["name"]: j["value"] for j in body["joints"]}["gripper"] == 10.0
    assert client.get("/sim/runner").json()["app"]["scene"] == "robot-so101_follower"
    reads = fake.leader.reads
    _wait(client, lambda b: fake.leader.reads > reads + 3)

    # The leader is busy while it drives the simulation; a second session is refused
    assert client.post("/devices/leader/calibrate").status_code == 409
    again = client.post("/sim/teleop", json={"robotId": "so101_follower", "deviceId": "leader"})
    assert again.status_code == 409

    assert client.delete("/sim/teleop").status_code == 204
    assert fake.leader.closed and client.get("/sim/teleop").json() is None
    assert client.delete("/sim/teleop").status_code == 404
    client.post("/sim/runner/stop")


@pytest.mark.usefixtures("local_server")
def test_a_failing_leader_stops_the_session(client, fake):
    client.post("/sim/teleop", json={"robotId": "so101_follower", "deviceId": "leader"})
    _wait(client, lambda b: b["state"] == "running")
    fake.leader.fail = "bus error"
    body = _wait(client, lambda b: b["state"] == "stopped")
    assert body["error"] == "bus error" and fake.leader.closed
    # A stopped session is replaced by a new start
    fake.leader.fail = None
    r = client.post("/sim/teleop", json={"robotId": "so101_follower", "deviceId": "leader"})
    assert r.status_code == 201
    client.delete("/sim/teleop")
    client.post("/sim/runner/stop")


def test_refused_starts(client, fake):
    def start(robot, device):
        return client.post("/sim/teleop", json={"robotId": robot, "deviceId": device})

    assert start("nope", "leader").status_code == 404
    assert start("so101_follower", "nope").status_code == 404
    r = start("arm", "leader")
    assert r.status_code == 422 and r.json()["error"]["details"]["teleop"] == []
    # A follower is not a leader
    assert start("so101_follower", "follower").status_code == 422
    assert client.get("/sim/teleop").json() is None


def test_capture_leader_rest(client, fake, envs_dir):
    from app.configs.config import config

    cfg = config.sim_robots_dir / "so101_follower.yaml"
    cfg.write_text("initial_pose:\n  shoulder_lift: -100\npercent: [gripper]\n")
    r = client.post("/sim/robots/so101_follower/leader-rest", json={"deviceId": "leader"})
    assert r.status_code == 200, r.text
    body = r.json()
    # FakeLeader reads 10.0 for every joint; initial_pose is kept
    assert body["leaderRest"]["gripper"] == 10.0
    assert body["initialPose"] == {"shoulder_lift": -100.0}
    assert fake.leader.closed and fake.leader.reads == 5
    # The leader is free again
    assert client.post("/devices/leader/calibrate").status_code != 409
    client.delete("/devices/leader/calibration")

    text = cfg.read_text()
    assert text.startswith("# Robot config") and "leader:\n  rest:" in text and "percent:" in text
    listed = {r["id"]: r for r in client.get("/sim/robots").json()}
    assert listed["so101_follower"]["leaderRest"] == body["leaderRest"]
    assert listed["arm"]["leaderRest"] is None and listed["arm"]["initialPose"] is None

    r = client.post("/sim/robots/arm/leader-rest", json={"deviceId": "leader"})
    assert r.status_code == 422


@pytest.mark.usefixtures("local_server")
def test_keyboard_jogs_any_robot(client, fake):
    # No leader type drives "arm"; the keyboard does
    r = client.post("/sim/teleop", json={"robotId": "arm", "deviceId": "keyboard"})
    assert r.status_code == 201, r.text
    assert client.put("/sim/teleop/jog", json={"velocities": {}}).status_code == 409  # starting
    body = _wait(client, lambda b: b["state"] == "running" and b["joints"])
    assert [j["name"] for j in body["joints"]] == ["joint1", "joint2"]

    # Held keys move the joint; speeds are capped; they stop when no longer refreshed
    assert client.put("/sim/teleop/jog", json={"velocities": {"joint2": 999}}).status_code == 204
    moved = _wait(client, lambda b: {j["name"]: j["value"] for j in b["joints"]}["joint2"] > 1)
    time.sleep(1.0)  # past JOG_HOLD_S: the loop sends {} again
    a = {j["name"]: j["value"] for j in client.get("/sim/teleop").json()["joints"]}["joint2"]
    time.sleep(0.5)
    b = {j["name"]: j["value"] for j in client.get("/sim/teleop").json()["joints"]}["joint2"]
    assert a == b and a > 1 and moved["deviceId"] == "keyboard"

    # TCP: only for a robot with robot.yaml tcp
    assert client.put("/sim/teleop/jog", json={"twist": [0.05, 0, 0, 0, 0, 0]}).status_code == 422
    from app.configs.config import config

    (config.sim_robots_dir / "arm.yaml").write_text("tcp:\n  link: link2\n")
    assert client.put("/sim/teleop/jog", json={"twist": [9, 0, 0, 0, 0, 0]}).status_code == 204
    tcp = _wait(client, lambda b: b["tcp"] and b["tcp"][0] > 0.02)["tcp"]
    assert tcp[1:] == [0.0] * 5  # capped at 0.25 m/s, x only
    assert client.get("/sim/robots").json()[0]["tcp"] == "link2"

    assert client.delete("/sim/teleop").status_code == 204
    assert client.put("/sim/teleop/jog", json={"velocities": {}}).status_code == 404
    client.post("/sim/runner/stop")


@pytest.mark.usefixtures("local_server")
def test_keyboard_jogs_a_tool(client, fake):
    from tests.support import write_sim_tool

    write_sim_tool("hand")

    def start(device, kind="tool", tool="hand"):
        return client.post("/sim/teleop", json={"robotId": tool, "deviceId": device, "kind": kind})

    assert start("keyboard", tool="nope").status_code == 404
    assert start("leader").status_code == 422
    r = start("keyboard")
    assert r.status_code == 201, r.text
    body = _wait(client, lambda b: b["state"] == "running" and b["joints"])
    assert body["kind"] == "tool"
    assert client.get("/sim/runner").json()["app"]["scene"] == "tool-hand"
    assert client.put("/sim/teleop/jog", json={"velocities": {"joint1": 30}}).status_code == 204
    _wait(client, lambda b: {j["name"]: j["value"] for j in b["joints"]}["joint1"] > 0.5)
    # A tool has no TCP
    assert client.put("/sim/teleop/jog", json={"twist": [0.05, 0, 0, 0, 0, 0]}).status_code == 422
    client.delete("/sim/teleop")
    client.post("/sim/runner/stop")

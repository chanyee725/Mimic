import yaml

from app.configs.config import config
from app.core import storage
from app.services import rigs, tasks
from app.services.rigs import file_format as rigs_file
from app.services.rigs import rigs as rigs_store
from app.services.rigs.file_format import RigFile

from tests.conftest import FIXTURES

SIM_RIG = """\
id: so101-sim
name: SO-101 Sim
sim:
  env: pick-red-cube
robot:
  id: sim-follower
  type: so101_follower
  name: SO-101 Follower (Isaac Sim)
  joints: [shoulder_pan, shoulder_lift, elbow_flex, wrist_flex, wrist_roll, gripper]
# The real leader arm drives the simulated follower
device:
  id: leader
  type: so101_leader
  name: SO-101 Leader
  port: /dev/null
cameras:
  top: { id: sim-top, name: Top camera (sim), resolution: 640x480 }
rates:
  action_hz: 60
  video_fps: 30
"""


def _add_sim_rig() -> None:
    storage.write_text("rigs/so101-sim.yaml", SIM_RIG)
    rigs.reset()


def _add_sim_task() -> None:
    doc = yaml.safe_load((FIXTURES / "tasks" / "stack-two-blocks.yaml").read_text())
    doc |= {"task_id": "sim-stack", "rig": "so101-sim", "cameras": ["top"]}
    folder = config.data_dir / "tasks"
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "sim-stack.yaml").write_text(yaml.safe_dump(doc, allow_unicode=True))
    tasks.reset()


def test_sim_rig_is_listed_with_its_environment(client):
    _add_sim_rig()
    rig = client.get("/rigs/so101-sim").json()
    assert rig["kind"] == "sim" and rig["envId"] == "pick-red-cube"
    assert client.get("/rigs/so101-kit").json()["kind"] == "real"
    devices = {d["id"]: d for d in client.get("/rigs/so101-sim/devices").json()}
    assert devices["sim-follower"]["simulated"] and devices["sim-top"]["simulated"]
    assert devices["sim-follower"]["port"] == ""
    assert devices["sim-follower"]["calibration"] == {"done": True, "note": "Not required"}
    # The leader is the real kit's device (the first rig declaring an id wins)
    assert not devices["leader"]["simulated"]
    assert not client.get("/devices/top").json()["simulated"]


def test_sim_rig_round_trip():
    _add_sim_rig()
    spec = rigs_store._specs["so101-sim"]
    text = rigs_file.dumps(spec)
    assert "sim:\n  env: pick-red-cube" in text and "port: ''" not in text
    assert RigFile.model_validate(yaml.safe_load(text)) == spec


def test_simulated_devices_have_no_port_or_calibration(client):
    _add_sim_rig()
    assert client.put("/devices/sim-follower/port", json={"port": "/dev/x"}).status_code == 400
    assert client.post("/devices/sim-follower/calibrate").status_code == 400


def test_simulated_device_test_asks_isaac_sim(client):
    _add_sim_rig()
    d = client.post("/devices/sim-follower/test").json()
    # No Isaac Sim server in tests
    assert d["health"] == "off" and "not reachable" in d["check"]["message"]


def test_sim_rig_refuses_teleop_and_capture_until_the_bridge_exists(client):
    _add_sim_rig()
    _add_sim_task()
    r = client.post("/rigs/so101-sim/teleop")
    assert r.status_code == 503 and "not connected" in r.json()["error"]["message"]
    r = client.post("/capture/start", json={"taskId": "sim-stack", "operator": "OP-01"})
    assert r.status_code == 503


def test_recordings_filter_by_rig_kind(client, task, record):
    record()
    assert client.get("/recordings?kind=real").json()["total"] == 1
    assert client.get("/recordings?kind=sim").json()["total"] == 0
    assert client.get("/recordings").json()["items"][0]["simEnv"] is None

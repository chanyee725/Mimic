"""Simulation entities: scanned environments, evaluation jobs and their episodes."""

from typing import Literal

from pydantic import Field

from app.schemas.common import CamelModel

Randomization = Literal["none", "low", "high"]
SimJobStatus = Literal["running", "queued", "done", "failed", "stopped"]
EpisodeResult = Literal["success", "fail"]


class SimEnvFile(CamelModel):
    path: str
    size_kb: int = Field(alias="sizeKB")


class SimEnv(CamelModel):
    """A Python script under the environments folder (build(scene) lays out the stage): a
    top-level `<id>.py` or a folder with `env.py`. Robot tags live in <sim folder>/envs.yaml."""

    id: str
    name: str
    path: str  # absolute path of the file or folder
    script: str  # env.py for a folder, the file name for a top-level script
    size_kb: int = Field(alias="sizeKB")
    files: list[SimEnvFile] = []
    registered_at: str
    updated_at: str
    robots: list[str] = []  # robot tags (robots/<name>); [] = untagged, fits any rig
    rig_ids: list[str] = (
        []
    )  # configured rigs whose follower types are all tagged (every rig when untagged)
    thumbnail: bool = False  # an image is served by /sim/envs/{id}/thumbnail


class SimAsset(CamelModel):
    """A robot or tool USD under <sim folder>/robots/ or tools/: <id>.usd[a|c] or
    <id>/<id>.usd[a|c] with its sub-files."""

    id: str  # a robot is named after the LeRobot type of the follower it simulates (so101_follower)
    path: str  # absolute path of the root USD
    size_kb: int = Field(alias="sizeKB")
    files: list[SimEnvFile] = []  # relative to the asset folder (the file name for a single file)
    updated_at: str
    teleop: list[str] = []  # leader types that can drive it (so101_follower ← so101_leader)
    tcp: str | None = None  # robots: link the keyboard TCP jog moves (robot.yaml tcp.link)
    # robots: start pose from <id>/robot.yaml (joint → degrees; percent joints 0–100), null when unset
    initial_pose: dict[str, float] | None = None
    # robots: what a leader reads in initial_pose (robot.yaml leader.rest), null when unset
    leader_rest: dict[str, float] | None = None


class SimGpu(CamelModel):
    id: str
    name: str
    vram: str
    busy_by: str | None = None


class SimConfig(CamelModel):
    envs_dir: str
    gpu: SimGpu | None  # null when nvidia-smi finds no GPU


SimAppState = Literal["stopped", "starting", "running", "exited"]


class SimRunnerApp(CamelModel):
    """The Isaac Sim app process behind the server."""

    state: SimAppState
    display: Literal["window", "headless"] | None = None
    device: Literal["gpu", "cpu"] | None = None
    pid: int | None = None
    scene: str | None = None  # id of the open environment
    error: str | None = None
    joints: dict[str, float] | None = None  # drive target per joint of the open robot (degrees)
    tcp: list[float] | None = None  # TCP pose [x, y, z (m), roll, pitch, yaw (deg)] while playing


class SimRunner(CamelModel):
    mode: Literal["local", "remote"]
    display: Literal["window", "headless"]  # from settings; used when the app starts
    device: Literal["gpu", "cpu"] = "gpu"  # from settings: physics device of the app
    url: str
    reachable: bool
    app: SimRunnerApp | None  # null when the server is not reachable


class SimTeleopJoint(CamelModel):
    name: str
    value: float | None = None  # leader position: degrees, gripper 0–100


class SimTeleop(CamelModel):
    """A leader arm (or the keyboard) driving the robot or tool open alone in Isaac Sim."""

    robot_id: str  # the robot or tool id
    kind: Literal["robot", "tool"] = "robot"
    device_id: str
    state: Literal["starting", "running", "stopped"]  # starting: waiting for the scene
    hz: float | None = None  # measured send rate
    target_hz: int
    error: str | None = None
    started_at: str
    joints: list[SimTeleopJoint] = []
    tcp: list[float] | None = (
        None  # keyboard: TCP pose [x, y, z (m, world), roll, pitch, yaw (deg)]
    )


class SimEpisode(CamelModel):
    index: int
    seed: int
    success: bool
    seconds: float
    reason: str | None = None


class SimJob(CamelModel):
    id: str
    model_id: str
    env_id: str
    status: SimJobStatus
    episodes: int
    randomization: Randomization
    seed_start: int
    max_seconds: float
    started_at: str | None = None
    elapsed_s: float | None = None
    eta_s: float | None = None
    done: int = 0
    succeeded: int = 0
    failure_reasons: dict[str, int] = {}
    error: str | None = None

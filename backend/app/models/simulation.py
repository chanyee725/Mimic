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
    """A USD stage under the environments folder: a top-level file or a folder with its assets."""

    id: str
    name: str
    path: str  # absolute path of the file or folder
    scene: str  # stage file, relative to the folder (the file name for a top-level file)
    size_kb: int = Field(alias="sizeKB")
    files: list[SimEnvFile] = []
    registered_at: str
    updated_at: str


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
    pid: int | None = None
    scene: str | None = None  # id of the open environment
    error: str | None = None


class SimRunner(CamelModel):
    mode: Literal["local", "remote"]
    display: Literal["window", "headless"]  # from settings; used when the app starts
    url: str
    reachable: bool
    app: SimRunnerApp | None  # null when the server is not reachable


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

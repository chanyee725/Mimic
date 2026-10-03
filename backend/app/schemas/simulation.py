from typing import Literal

from pydantic import Field

from app.schemas.common import CamelModel

SimEnvState = Literal["ready", "invalid"]
Randomization = Literal["none", "low", "high"]
SimJobStatus = Literal["running", "queued", "done", "failed", "stopped"]
EpisodeResult = Literal["success", "fail"]


class SimEnvFile(CamelModel):
    path: str
    size_kb: int = Field(alias="sizeKB")


class SimEnv(CamelModel):
    id: str
    name: str
    path: str
    description: str | None = None
    task_id: str | None = None
    cameras: list[str] = []
    action_dim: int = 0
    max_seconds: float = 0
    calibrated: bool = False
    state: SimEnvState
    error: str | None = None
    manifest: str = ""
    files: list[SimEnvFile] = []
    registered_at: str
    updated_at: str


class RescanResult(CamelModel):
    dir: str
    scanned_at: str
    envs: list[SimEnv]


class CompatIssue(CamelModel):
    level: Literal["error", "warn"]
    text: str


class ModelCompat(CamelModel):
    model_id: str
    usable: bool
    issues: list[CompatIssue]


class SimGpu(CamelModel):
    id: str
    name: str
    vram: str
    busy_by: str | None = None


class SimConfig(CamelModel):
    envs_dir: str
    gpu: SimGpu


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


class SimJobCreate(CamelModel):
    model_id: str
    env_id: str
    episodes: int = Field(50, ge=1, le=10000)
    seed_start: int = Field(1000, ge=0)
    max_seconds: float = Field(40, gt=0, le=3600)
    randomization: Randomization = "low"


class SimEpisodeEvent(CamelModel):
    job_id: str
    episode: SimEpisode

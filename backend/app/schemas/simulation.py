from typing import Literal

from pydantic import Field

from app.models.simulation import Randomization, SimEnv, SimEpisode
from app.schemas.common import CamelModel


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

from typing import Literal

from pydantic import Field

from app.models.simulation import Randomization, SimEnv, SimEpisode
from app.schemas.common import CamelModel


class RescanResult(CamelModel):
    dir: str
    scanned_at: str
    envs: list[SimEnv]


class SimEnvPatch(CamelModel):
    robots: list[str]


class SimTeleopStart(CamelModel):
    robot_id: str
    device_id: str
    display: Literal["window", "headless"] | None = None


class SimJog(CamelModel):
    velocities: dict[str, float] | None = None  # joint → degrees per second while held; {} stops
    # TCP (tool) frame [vx, vy, vz (m/s), wx, wy, wz (deg/s)] while held; zeros stop
    twist: list[float] | None = Field(None, min_length=6, max_length=6)


class LeaderRestCapture(CamelModel):
    device_id: str  # leader held in the robot's initial pose; its reading becomes leader.rest


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


class RunnerStart(CamelModel):
    """Isaac Sim display for this start; the Connection setting when omitted."""

    display: Literal["window", "headless"] | None = None

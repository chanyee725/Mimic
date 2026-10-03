from typing import Literal

from pydantic import Field

from app.core.schemas import CamelModel

DatasetKind = Literal["lerobot", "mcap"]
DatasetStatus = Literal["ready", "converting", "failed"]


class DatasetFeature(CamelModel):
    key: str
    dtype: str
    shape: str
    note: str | None = None


class DatasetEpisode(CamelModel):
    index: int
    source: str
    length_s: float
    frames: int


class Hub(CamelModel):
    pushed: bool
    private: bool


class Dataset(CamelModel):
    kind: DatasetKind
    repo_id: str
    task_id: str
    rig_id: str
    format: str
    fps: int
    status: DatasetStatus
    progress: int | None = None
    error: str | None = None
    created_at: str
    size_gb: float = Field(alias="sizeGB")
    hub: Hub
    features: list[DatasetFeature]
    episode_count: int


class ConvertPreview(CamelModel):
    fps: int
    action_hz: int
    features: list[DatasetFeature]
    episodes: int
    frames: int
    length_s: float
    mcap_mb: float = Field(alias="mcapMB")
    est_output_mb: float = Field(alias="estOutputMB")
    recorded_from: str | None = None
    recorded_to: str | None = None


class ConvertBody(CamelModel):
    task_id: str
    # "<namespace>/<name>", e.g. local/stack_two_blocks
    repo_id: str = Field(pattern=r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
    exclude: list[str] = []
    format: Literal["lerobot_v3"] = "lerobot_v3"


class PushBody(CamelModel):
    private: bool = True

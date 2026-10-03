from typing import Literal

from pydantic import Field

from app.models.datasets import DatasetFeature
from app.schemas.common import CamelModel

# "<namespace>/<name>", e.g. local/stack_two_blocks; parts never start with "."
REPO_ID = r"^[A-Za-z0-9_-][A-Za-z0-9_.-]*/[A-Za-z0-9_-][A-Za-z0-9_.-]*$"


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
    repo_id: str = Field(pattern=REPO_ID)
    exclude: list[str] = []
    format: Literal["lerobot_v3"] = "lerobot_v3"


class PushBody(CamelModel):
    private: bool = True


class MergeSource(CamelModel):
    repo_id: str
    episodes: int
    frames: int
    fps: int
    rig_id: str
    task_id: str


class MergePreview(CamelModel):
    sources: list[MergeSource]
    fps: int | None
    episodes: int
    frames: int
    size_gb: float = Field(alias="sizeGB")
    features: list[DatasetFeature]
    problems: list[str]


class MergeBody(CamelModel):
    sources: list[str]
    repo_id: str = Field(pattern=REPO_ID)

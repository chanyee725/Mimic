from typing import Literal

from pydantic import Field

from app.models.datasets import DatasetFeature
from app.schemas.common import CamelModel


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

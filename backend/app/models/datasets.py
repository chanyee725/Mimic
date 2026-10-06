"""Dataset domain entities (LeRobot datasets and their episodes)."""

from typing import Literal

from pydantic import Field

from app.schemas.common import CamelModel

DatasetKind = Literal["lerobot", "mcap"]
DatasetStatus = Literal["ready", "converting", "failed"]
# Where the episodes were recorded: the real robot or an Isaac Sim environment
World = Literal["real", "sim"]
WORLDS: tuple[World, ...] = ("real", "sim")


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
    # Downloaded from the Hub (Pull) rather than made on this station
    pulled: bool = False
    # Hub repo it was pushed to / pulled from; null until then
    repo: str | None = None
    # Upload running (Push or a RunPod job); error of the last failed upload
    pushing: bool = False
    error: str | None = None


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
    # repoIds a merged dataset was made from (null for converted ones)
    sources: list[str] | None = None
    # Kinds of episodes it holds, in WORLDS order (a merge can hold both)
    worlds: list[World] = ["real"]

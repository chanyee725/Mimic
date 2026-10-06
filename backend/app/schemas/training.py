from typing import Literal

from pydantic import Field

from app.models.training import Compute, ParamValue
from app.schemas.common import CamelModel

MetricSeries = Literal[
    "loss_raw", "loss", "grad_norm", "lr", "update_s", "data_s", "gpu_util", "gpu_mem"
]


class RunPodGpu(CamelModel):
    name: str
    vram_gb: int = Field(alias="vramGB")
    price_per_hr: float
    community: bool
    stock: Literal["high", "low", "none"]
    type_id: str  # RunPod gpuTypeId, e.g. "NVIDIA GeForce RTX 4090"


class RunPodOptions(CamelModel):
    cloud: Literal["secure", "community"] = "secure"
    pricing: Literal["on-demand", "spot"] = "on-demand"
    gpu_count: Literal[1, 2, 4] = 1
    max_hours: float = Field(default=6, ge=0)
    budget: float = Field(default=0, ge=0)
    disk_gb: int = Field(default=50, gt=0, alias="diskGB")
    volume: str = "none"
    region: str = "any"
    terminate_on_finish: bool = True
    push_to_hub: bool = False


class RunPodVolume(CamelModel):
    id: str
    label: str
    note: str


class PriceFactor(CamelModel):
    cloud: dict[str, float]
    pricing: dict[str, float]


class RunPodConfig(CamelModel):
    gpus: list[RunPodGpu]
    regions: list[str]
    volumes: list[RunPodVolume]
    price_factor: PriceFactor
    defaults: RunPodOptions


class LocalGpu(CamelModel):
    id: str
    name: str
    vram: str
    busy_by: str | None = None


class Param(CamelModel):
    key: str
    label: str
    default: ParamValue
    hint: str | None = None


class ParamGroup(CamelModel):
    title: str
    params: list[Param]


class TrainingConfig(CamelModel):
    policy: str
    policy_base: str
    local_gpus: list[LocalGpu]
    runpod: RunPodConfig
    param_groups: list[ParamGroup]
    trainable_datasets: list[str]


class JobCreate(CamelModel):
    dataset: str
    compute: Compute
    gpu: str
    overrides: dict[str, ParamValue] = {}
    runpod: RunPodOptions | None = None


class CommandOut(CamelModel):
    command: str


class CommandPreview(CamelModel):
    command: str
    rate_per_hr: float | None = None
    cap_hours: float | None = None
    max_cost_usd: float | None = None


class Metrics(CamelModel):
    from_step: int
    to_step: int
    every: int
    series: dict[MetricSeries, list[float]]


class JobLog(CamelModel):
    """End of a job's train.log (tqdm redraws collapsed)."""

    lines: list[str]
    truncated: bool


class CheckpointPush(CamelModel):
    repo: str | None = None


class CheckpointPushed(CamelModel):
    repo: str


class CheckpointSave(CamelModel):
    name: str = Field(min_length=1, max_length=120)

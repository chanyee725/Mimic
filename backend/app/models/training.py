"""Training domain entities: jobs, their pods and checkpoints."""

from typing import Literal

from pydantic import Field

from app.schemas.common import CamelModel

JobStatus = Literal["running", "queued", "done", "failed", "stopped"]
Compute = Literal["local", "runpod"]
ParamValue = bool | int | float | str


class PodState(CamelModel):
    state: Literal["running", "idle", "terminated"]
    auto_terminate: bool
    since: str | None = None
    idle_for_s: int | None = None


class Checkpoint(CamelModel):
    step: int
    saved_at: str
    size_mb: float = Field(alias="sizeMB")


class TrainJob(CamelModel):
    id: str
    policy: str
    dataset: str
    task_id: str
    compute: Compute
    gpu: str
    pod: str | None = None
    price_per_hr: float | None = None
    pod_state: PodState | None = None
    status: JobStatus
    step: int
    total: int
    batch: int
    epoch: int
    epochs: int
    started_at: str | None = None
    elapsed_s: int | None = None
    eta_s: int | None = None
    steps_per_s: float | None = None
    cost_usd: float | None = None
    overrides: dict[str, ParamValue] = {}
    checkpoints: list[Checkpoint] = []
    error: str | None = None

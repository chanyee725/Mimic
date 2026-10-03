from typing import Literal
from zoneinfo import ZoneInfo

from pydantic import Field, field_validator, model_serializer

from app.core.schemas import CamelModel

ConnState = Literal["ok", "error", "unknown"]
SecretName = Literal["hf_token", "runpod_api_key", "wandb_api_key", "slack_webhook"]
TestTarget = Literal["hf", "runpod", "wandb", "api", "grpc", "webrtc", "slack"]
Section = Literal[
    "station", "integrations", "storage", "connection", "recording", "training", "notifications"
]


class Secret(CamelModel):
    set: bool
    last4: str | None = None

    @model_serializer(mode="wrap")
    def _omit_empty(self, handler):
        # {"set": false} rather than {"set": false, "last4": null}
        return {k: v for k, v in handler(self).items() if v is not None}


class Operator(CamelModel):
    id: str = Field(pattern=r"^OP-\d{2}$")
    role: Literal["operator", "admin"]


class StationSettings(CamelModel):
    name: str = Field(min_length=1)
    id: str
    timezone: str
    operators: list[Operator]

    @field_validator("timezone")
    @classmethod
    def _tz(cls, v: str) -> str:
        try:
            ZoneInfo(v)
        except Exception:
            raise ValueError(f"unknown timezone '{v}'")
        return v

    @field_validator("operators")
    @classmethod
    def _operators(cls, v: list[Operator]) -> list[Operator]:
        ids = [o.id for o in v]
        if len(set(ids)) != len(ids):
            raise ValueError("operator ids must be unique")
        if not any(o.role == "admin" for o in v):
            raise ValueError("at least one operator must be an admin")
        return v


class HfSettings(CamelModel):
    token: Secret
    namespace: str
    private_by_default: bool
    state: ConnState


class RunpodSettings(CamelModel):
    api_key: Secret
    region: str
    volume: str
    monthly_budget: float = Field(ge=0)
    idle_alert_min: int = Field(ge=0)
    spent_this_month: float
    state: ConnState


class WandbSettings(CamelModel):
    api_key: Secret
    project: str
    enable_by_default: bool
    state: ConnState


class Integrations(CamelModel):
    hf: HfSettings
    runpod: RunpodSettings
    wandb: WandbSettings


class StorageSettings(CamelModel):
    raw_path: str = Field(min_length=1)
    datasets_path: str = Field(min_length=1)
    models_path: str = Field(min_length=1)
    warn_at_pct: int = Field(ge=1, le=100)
    delete_rejected: bool
    delete_rejected_after_days: int = Field(ge=0)
    keep_checkpoints: int = Field(ge=1)


class Endpoint(CamelModel):
    url: str = Field(min_length=1)
    state: ConnState
    latency_ms: int | None = None


class WebrtcSettings(CamelModel):
    stun: str
    turn: str
    state: ConnState


class ConnectionSettings(CamelModel):
    api: Endpoint
    grpc: Endpoint
    webrtc: WebrtcSettings


class RecordingSettings(CamelModel):
    action_hz: int = Field(gt=0)
    video_fps: int = Field(gt=0)
    mcap_compression: Literal["zstd", "lz4", "none"]
    chunk_mb: int = Field(gt=0, alias="chunkMB")
    codec: Literal["av1", "h264"]
    crf: int = Field(ge=0, le=63)


class TrainingSettings(CamelModel):
    lerobot_commit: str
    default_compute: Literal["local", "runpod"]
    save_freq: int = Field(ge=1)
    sim_gpu: str
    sim_envs_path: str


class NotificationEvent(CamelModel):
    key: str
    label: str
    on: bool


class NotificationSettings(CamelModel):
    slack_webhook: Secret
    events: list[NotificationEvent]


class Settings(CamelModel):
    version: int = 1
    station: StationSettings
    integrations: Integrations
    storage: StorageSettings
    connection: ConnectionSettings
    recording: RecordingSettings
    training: TrainingSettings
    notifications: NotificationSettings


SECTIONS: dict[str, type[CamelModel]] = {
    "station": StationSettings,
    "integrations": Integrations,
    "storage": StorageSettings,
    "connection": ConnectionSettings,
    "recording": RecordingSettings,
    "training": TrainingSettings,
    "notifications": NotificationSettings,
}


class SecretValue(CamelModel):
    value: str = Field(min_length=8)


class ConnTestResult(CamelModel):
    state: ConnState
    latency_ms: int | None = None
    detail: str | None = None


class DiskPart(CamelModel):
    key: Literal["raw", "datasets", "models", "other"]
    label: str
    gb: float


class Disk(CamelModel):
    total_gb: float = Field(alias="totalGB")
    parts: list[DiskPart]


class ShortcutKey(CamelModel):
    keys: list[str]
    action: str


class ShortcutGroup(CamelModel):
    page: str
    keys: list[ShortcutKey]


class VersionRow(CamelModel):
    k: str
    v: str

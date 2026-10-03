"""Settings document entities."""

from typing import Literal
from zoneinfo import ZoneInfo

from pydantic import Field, field_validator, model_serializer

from app.schemas.common import CamelModel

ConnState = Literal["ok", "error", "unknown"]
SecretName = Literal["hf_token", "runpod_api_key", "wandb_api_key", "slack_webhook"]
Section = Literal["station", "integrations", "storage", "connection", "training", "notifications"]


class Secret(CamelModel):
    set: bool
    last4: str | None = None

    @model_serializer(mode="wrap")
    def _omit_empty(self, handler):
        # {"set": false} rather than {"set": false, "last4": null}
        return {k: v for k, v in handler(self).items() if v is not None}


class StationSettings(CamelModel):
    name: str = Field(min_length=1)
    id: str
    timezone: str

    @field_validator("timezone")
    @classmethod
    def _tz(cls, v: str) -> str:
        try:
            ZoneInfo(v)
        except Exception:
            raise ValueError(f"unknown timezone '{v}'")
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
    training: TrainingSettings
    notifications: NotificationSettings


SECTIONS: dict[str, type[CamelModel]] = {
    "station": StationSettings,
    "integrations": Integrations,
    "storage": StorageSettings,
    "connection": ConnectionSettings,
    "training": TrainingSettings,
    "notifications": NotificationSettings,
}

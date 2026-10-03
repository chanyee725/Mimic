"""Settings document entities."""

from typing import Literal

from pydantic import Field, model_serializer

from app.schemas.common import CamelModel

ConnState = Literal["ok", "error", "unknown"]
SecretName = Literal["hf_token", "runpod_api_key", "slack_webhook"]
Section = Literal["integrations", "storage", "connection", "notifications"]


class Secret(CamelModel):
    """Derived from the .env value; the raw value is never part of the document."""

    set: bool
    last4: str | None = None

    @model_serializer(mode="wrap")
    def _omit_empty(self, handler):
        # {"set": false} rather than {"set": false, "last4": null}
        return {k: v for k, v in handler(self).items() if v is not None}


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


class Integrations(CamelModel):
    hf: HfSettings
    runpod: RunpodSettings


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


class NotificationEvent(CamelModel):
    key: str
    label: str
    on: bool


class NotificationSettings(CamelModel):
    slack_webhook: Secret
    events: list[NotificationEvent]


class Settings(CamelModel):
    version: int = 1
    integrations: Integrations
    storage: StorageSettings
    connection: ConnectionSettings
    notifications: NotificationSettings


SECTIONS: dict[str, type[CamelModel]] = {
    "integrations": Integrations,
    "storage": StorageSettings,
    "connection": ConnectionSettings,
    "notifications": NotificationSettings,
}

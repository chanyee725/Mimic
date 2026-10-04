"""Settings document entities."""

from typing import Literal

from pydantic import Field, model_serializer

from app.schemas.common import CamelModel

ConnState = Literal["ok", "error", "unknown"]
SecretName = Literal["hf_token", "runpod_api_key", "slack_webhook"]
Section = Literal["integrations", "connection", "notifications"]


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
    # Not tracked yet (needs the RunPod billing API)
    spent_this_month: float | None = None
    state: ConnState


class Integrations(CamelModel):
    hf: HfSettings
    runpod: RunpodSettings


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
    connection: ConnectionSettings
    notifications: NotificationSettings


SECTIONS: dict[str, type[CamelModel]] = {
    "integrations": Integrations,
    "connection": ConnectionSettings,
    "notifications": NotificationSettings,
}

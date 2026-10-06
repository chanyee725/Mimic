"""Settings document entities."""

from typing import Literal

from pydantic import Field, model_serializer, model_validator

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
    # Training options (region, volume, budget) live on the RunPod training form
    api_key: Secret
    state: ConnState


class Integrations(CamelModel):
    hf: HfSettings
    runpod: RunpodSettings


IsaacMode = Literal["local", "remote"]
IsaacDisplay = Literal["window", "headless"]
IsaacDevice = Literal["gpu", "cpu"]


class IsaacSettings(CamelModel):
    """Isaac Sim server: started here (local) or a sim server's URL (remote)."""

    mode: IsaacMode
    display: IsaacDisplay
    device: IsaacDevice = "gpu"  # PhysX: GPU dynamics + broadphase, or CPU
    python: str = Field(min_length=1)  # local: Python with isaacsim, relative to the repo root
    port: int = Field(ge=1, le=65535)  # local: server port on 127.0.0.1
    url: str = ""  # remote: http://host:port
    state: ConnState
    latency_ms: int | None = None

    @model_validator(mode="after")
    def _remote_needs_url(self):
        if self.mode == "remote" and not self.url.strip():
            raise ValueError("url is required for a remote Isaac Sim server")
        return self


class ConnectionSettings(CamelModel):
    isaac: IsaacSettings


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

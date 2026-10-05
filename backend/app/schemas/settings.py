"""Settings API shapes: secret input, connection tests and read-only info."""

from typing import Literal

from pydantic import Field

from app.models.settings import ConnState
from app.schemas.common import CamelModel

TestTarget = Literal["hf", "runpod", "api", "grpc", "webrtc", "isaac", "slack"]


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

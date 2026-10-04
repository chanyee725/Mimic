"""Rig API request bodies (responses are entities from app.models.rigs)."""

from app.schemas.common import CamelModel


class PortUpdate(CamelModel):
    port: str

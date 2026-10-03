from pydantic import Field

from app.schemas.common import CamelModel


class ModelFile(CamelModel):
    path: str
    size_mb: float = Field(alias="sizeMB")


class ModelPatch(CamelModel):
    name: str = Field(min_length=1, max_length=120)


class ModelPush(CamelModel):
    repo: str | None = None
    private: bool | None = None

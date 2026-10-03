from pydantic import Field

from app.core.schemas import CamelModel


class ModelEval(CamelModel):
    at: str
    trials: int
    success: int
    instruction: str


class Model(CamelModel):
    id: str
    name: str
    task_id: str
    dataset: str
    job_id: str
    step: int
    loss: float
    size_mb: float = Field(alias="sizeMB")
    saved_at: str
    local_path: str | None = None
    hub_repo: str | None = None
    evals: list[ModelEval] = []


class ModelFile(CamelModel):
    path: str
    size_mb: float = Field(alias="sizeMB")


class ModelPatch(CamelModel):
    name: str = Field(min_length=1, max_length=120)


class ModelPush(CamelModel):
    repo: str | None = None
    private: bool | None = None

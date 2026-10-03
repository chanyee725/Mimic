"""Runtime configuration (env vars prefixed with VLA_)."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]


class Config(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="VLA_", env_file=".env", extra="ignore")

    api_prefix: str = "/api/v1"
    cors_origins: list[str] = ["http://localhost:5173"]
    station_id: str = "Station 01"
    timezone: str = "Asia/Seoul"
    # Folder scanned for Isaac Sim environments (one sub-folder per environment)
    sim_envs_dir: Path = REPO_ROOT / "sim" / "envs"


config = Config()

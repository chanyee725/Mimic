"""Runtime configuration (env vars prefixed with VLA_, also read from the repo-root .env)."""

import os
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]
# Repo-root .env, whatever the working directory; VLA_ENV_FILE_PATH moves it (tests)
ENV_FILE = Path(os.environ.get("VLA_ENV_FILE_PATH") or REPO_ROOT / ".env")


class Config(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="VLA_", env_file=ENV_FILE, extra="ignore")

    api_prefix: str = "/api/v1"
    cors_origins: list[str] = ["http://localhost:5173"]
    station_id: str = "Station 01"
    timezone: str = "Asia/Seoul"
    # Folder scanned for Isaac Sim environments (one sub-folder per environment)
    sim_envs_dir: Path = REPO_ROOT / "sim" / "envs"
    # Station data kept as YAML (tasks, settings, rigs, …)
    data_dir: Path = REPO_ROOT / "data"
    # .env holding the secrets (HF_TOKEN, RUNPOD_API_KEY, …); settings edits it
    env_file_path: Path = ENV_FILE

    @field_validator("sim_envs_dir", "data_dir", "env_file_path")
    @classmethod
    def _from_repo_root(cls, v: Path) -> Path:
        # "~" expands; relative paths (e.g. VLA_SIM_ENVS_DIR=sim/envs) start at the repo root
        v = Path(v).expanduser()
        return v if v.is_absolute() else REPO_ROOT / v


config = Config()

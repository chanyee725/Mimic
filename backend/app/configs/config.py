"""Runtime configuration (env vars prefixed with VLA_, also read from the repo-root .env)."""

import os
from pathlib import Path

from pydantic import field_validator, model_validator
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
    # Isaac Sim: envs/ (environment scripts), robots/ (robot USDs they place) and tools/ (end effectors); unset = <data_dir>/sims
    sim_dir: Path | None = None
    # Station setup, committed: rigs/, settings/, calibration/ (hand-set, edited on Rigs / Settings)
    config_dir: Path = REPO_ROOT / "config"
    # Station data: tasks/ (YAML), recordings/, datasets/, models/, sims/ (Isaac Sim envs, robots)
    data_dir: Path = REPO_ROOT / "data"
    # Real devices (Rigs connection test / calibration): "lerobot", or "none" to never touch hardware
    device_driver: str = "lerobot"
    # .env holding the secrets (HF_TOKEN, RUNPOD_API_KEY, …); settings edits it
    env_file_path: Path = ENV_FILE

    @field_validator("sim_dir", "config_dir", "data_dir", "env_file_path")
    @classmethod
    def _from_repo_root(cls, v: Path) -> Path:
        # "~" expands; relative paths (e.g. VLA_SIM_DIR=data/sims) start at the repo root
        if v is None:
            return None
        v = Path(v).expanduser()
        return v if v.is_absolute() else REPO_ROOT / v

    @model_validator(mode="after")
    def _sims_under_data(self) -> "Config":
        if self.sim_dir is None:
            self.sim_dir = self.data_dir / "sims"
        return self

    @property
    def sim_envs_dir(self) -> Path:
        """Scanned for environments: one script or folder with env.py each."""
        return self.sim_dir / "envs"

    @property
    def sim_robots_dir(self) -> Path:
        """Robot USDs the scripts place by name (scene.robot), never scanned."""
        return self.sim_dir / "robots"

    @property
    def sim_tools_dir(self) -> Path:
        """End-effector USDs (robot hands, grippers) a scene places by name (scene.tool)."""
        return self.sim_dir / "tools"

    # Everything the station records or builds lives under the data folder
    @property
    def recordings_dir(self) -> Path:
        return self.data_dir / "recordings"

    @property
    def datasets_dir(self) -> Path:
        return self.data_dir / "datasets"

    @property
    def calibration_dir(self) -> Path:
        """LeRobot calibration files: {robots|teleoperators}/<class>/<calibration id>.json."""
        return self.config_dir / "calibration"

    @property
    def models_dir(self) -> Path:
        return self.data_dir / "models"

    @property
    def training_dir(self) -> Path:
        """One folder per training job: job.yaml, train.log, metrics.jsonl, output/ (lerobot)."""
        return self.data_dir / "training"


config = Config()

"""Raw secrets in the repo-root .env (config.env_file_path), under the names other tools read.

The process environment wins over the file. Writes edit only the secret's line in .env
(comments and VLA_* vars stay) and keep the file at mode 0600. Values never leave the backend.
"""

import logging
import os

from dotenv import dotenv_values, set_key, unset_key

from app.configs.config import config
from app.core import storage

log = logging.getLogger(__name__)

# Secret name (API) → env var (huggingface_hub, runpod, Slack)
ENV_KEYS: dict[str, str] = {
    "hf_token": "HF_TOKEN",
    "runpod_api_key": "RUNPOD_API_KEY",
    "slack_webhook": "SLACK_WEBHOOK_URL",
}
LEGACY_FILE = "secrets.yaml"  # data/secrets.yaml, migrated into .env on load
HEADER = "# Station secrets and VLA_* overrides; never commit (see .env.example)\n"


def read() -> dict[str, str]:
    """Secret name → value for every secret set in the environment or .env."""
    path = config.env_file_path
    file = dotenv_values(path) if path.is_file() else {}
    out = {}
    for name, key in ENV_KEYS.items():
        value = os.environ.get(key) or file.get(key)
        if value:
            out[name] = value
    return out


def _ensure_file() -> None:
    path = config.env_file_path
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w") as f:
            f.write(HEADER)
    os.chmod(path, 0o600)


def write(name: str, value: str | None) -> None:
    """Set (or with None, remove) one secret's line in .env."""
    _ensure_file()
    path = config.env_file_path
    key = ENV_KEYS[name]
    if value is None:
        if key in dotenv_values(path):
            unset_key(path, key)
    else:
        set_key(path, key, value)
    os.chmod(path, 0o600)


def migrate_legacy() -> None:
    """Copy data/secrets.yaml into .env (keys not already set), then delete it."""
    if not storage.exists(LEGACY_FILE):
        return
    try:
        old = storage.read(LEGACY_FILE) or {}
        if not isinstance(old, dict):
            raise ValueError("expected a mapping")
    except (storage.StorageError, ValueError) as e:
        log.warning("%s is invalid, not migrating it: %s", storage.path(LEGACY_FILE), e)
        return
    current = read()
    for name, value in old.items():
        if name in ENV_KEYS and value and name not in current:
            write(name, str(value))
    storage.delete(LEGACY_FILE)
    log.info("moved %s into %s", LEGACY_FILE, config.env_file_path)

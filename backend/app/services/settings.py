"""Station settings, kept as data/settings/<part>.yaml; raw secrets in data/secrets.yaml (0600).

Part files hold only editable values: no document version (memory only, 1 on load) and no
live fields (state, latency, spend), so connection tests never churn the committed files.
Secrets never leave this module.
"""

import logging
from typing import Any

from pydantic import ValidationError
from pydantic.alias_generators import to_snake

from app.configs.config import config
from app.core import storage
from app.core.errors import ApiError, conflict, not_found
from app.core.events import bus
from app.seeds import load
from app.models.settings import (
    SECTIONS,
    ConnectionSettings,
    HfSettings,
    NotificationSettings,
    RunpodSettings,
    Secret,
    SecretName,
    Settings,
    StationSettings,
    StorageSettings,
    TrainingSettings,
    WandbSettings,
)
from app.schemas.common import CamelModel
from app.schemas.settings import ConnTestResult, Disk, ShortcutGroup, VersionRow
from app.utils.paths import display_path, resolve_user_path

log = logging.getLogger(__name__)

SETTINGS_DIR = "settings"
LEGACY_FILE = "settings.yaml"  # single-file layout, migrated on load
SECRETS_FILE = "secrets.yaml"
SECRETS_HEADER = "# write-only, do not commit\n"

# Part file name → (path in the snake_case document, model)
PARTS: dict[str, tuple[tuple[str, ...], type[CamelModel]]] = {
    "station": (("station",), StationSettings),
    "huggingface": (("integrations", "hf"), HfSettings),
    "runpod": (("integrations", "runpod"), RunpodSettings),
    "wandb": (("integrations", "wandb"), WandbSettings),
    "storage": (("storage",), StorageSettings),
    "connection": (("connection",), ConnectionSettings),
    "training": (("training",), TrainingSettings),
    "notifications": (("notifications",), NotificationSettings),
}
# Live values: kept in memory, never written (snake_case keys)
LIVE_FIELDS = {"state", "latency_ms", "spent_this_month"}

_doc: dict[str, Settings] = {}
# Raw secret values, mirrored to secrets.yaml
_secrets: dict[str, str] = {}
# Part → YAML text last written / loaded; a part is rewritten only when its text changes
_disk: dict[str, str] = {}

# Fields a PATCH never changes (live values, secrets, station id)
READ_ONLY = {"state", "latencyMs", "spentThisMonth", "token", "apiKey", "slackWebhook"}
READ_ONLY_IN = {"station": {"id"}}

# Secret name → (section, path inside it)
SECRET_PATHS: dict[str, tuple[str, ...]] = {
    "hf_token": ("integrations", "hf", "token"),
    "runpod_api_key": ("integrations", "runpod", "apiKey"),
    "wandb_api_key": ("integrations", "wandb", "apiKey"),
    "slack_webhook": ("notifications", "slackWebhook"),
}
TARGET_SECRET = {
    "hf": "hf_token",
    "runpod": "runpod_api_key",
    "wandb": "wandb_api_key",
    "slack": "slack_webhook",
}
# Mock round-trip times per target
LATENCY_MS = {"hf": 180, "runpod": 240, "wandb": 150, "slack": 210, "api": 4, "grpc": 2}


def reset() -> None:
    """Seed document overlaid with each part file; missing part files are written.

    A broken part file is left untouched (seed values are used) so it can be fixed by hand.
    Never rescans simulation here: it reads config.sim_envs_dir in its own reset.
    """
    _secrets.clear()
    _secrets.update(_read_secrets())
    _disk.clear()
    _migrate_legacy()

    data = _seed().model_dump(mode="json")
    loaded: set[str] = set()
    broken: set[str] = set()
    for part, (path, model) in PARTS.items():
        try:
            values = _read_part(part, _get_at(data, path), model)
        except _BrokenPart:
            broken.add(part)
            continue
        if values is not None:
            _set_at(data, path, values)
            loaded.add(part)

    doc = _reconcile(Settings.model_validate(data))
    _doc["current"] = doc
    # Broken files count as written: untouched until their part really changes
    current = doc.model_dump(mode="json")
    for part in broken:
        _disk[part] = storage.dumps(_persisted(_get_at(current, PARTS[part][0])))
    if "training" in loaded and doc.training.sim_envs_path:
        config.sim_envs_dir = resolve_user_path(doc.training.sim_envs_path)
    _write_settings()


def _seed() -> Settings:
    raw = load("settings", "SETTINGS")
    raw["training"]["simEnvsPath"] = display_path(config.sim_envs_dir)
    return Settings.model_validate({"version": 1, **raw})


def _part_file(part: str) -> str:
    return f"{SETTINGS_DIR}/{part}.yaml"


def _overlay(base: Any, top: Any) -> Any:
    """Nested dicts merge key by key; secrets ({set, last4}) and other values replace."""
    if isinstance(base, dict) and isinstance(top, dict) and "set" not in top:
        return {**base, **{k: _overlay(base.get(k), v) for k, v in top.items()}}
    return top


class _BrokenPart(Exception):
    pass


def _read_part(part: str, seed: dict[str, Any], model: type[CamelModel]) -> dict[str, Any] | None:
    """Seed values overlaid with the part file; None when missing, _BrokenPart when invalid.

    A valid file is remembered as written (normalised) so loading alone never rewrites it.
    """
    rel = _part_file(part)
    try:
        raw = storage.read(rel)
        if raw is None:
            return None
        if not isinstance(raw, dict):
            raise ValueError("expected a mapping")
        values = model.model_validate(_overlay(seed, raw)).model_dump(mode="json")
    except (storage.StorageError, ValidationError, ValueError) as e:
        log.warning("%s is invalid, using seed values: %s", storage.path(rel), e)
        raise _BrokenPart from e
    _disk[part] = storage.dumps(_persisted(values))
    return values


def _migrate_legacy() -> None:
    """Split an old data/settings.yaml into part files, then delete it."""
    if not storage.exists(LEGACY_FILE) or storage.exists(SETTINGS_DIR):
        return
    try:
        old = storage.read(LEGACY_FILE)
        if not isinstance(old, dict):
            raise ValueError("expected a mapping")
    except (storage.StorageError, ValueError) as e:
        log.warning("%s is invalid, not migrating it: %s", storage.path(LEGACY_FILE), e)
        return
    seed = _seed().model_dump(mode="json")
    for part, (path, model) in PARTS.items():
        try:
            values = _get_at(old, path)
            if not isinstance(values, dict):
                raise ValueError("missing")
            merged = model.model_validate(_overlay(_get_at(seed, path), values))
        except (KeyError, TypeError, ValueError, ValidationError) as e:
            log.warning("%s: '%s' not migrated, using seed values: %s", LEGACY_FILE, part, e)
            continue
        storage.write(_part_file(part), _persisted(merged.model_dump(mode="json")))
    storage.delete(LEGACY_FILE)
    log.info("migrated %s to %s/", LEGACY_FILE, SETTINGS_DIR)


def _read_secrets() -> dict[str, str]:
    try:
        data = storage.read(SECRETS_FILE) or {}
    except storage.StorageError as e:
        log.warning("%s is invalid, ignoring it: %s", storage.path(SECRETS_FILE), e)
        return {}
    if not isinstance(data, dict):
        return {}
    return {k: str(v) for k, v in data.items() if k in SECRET_PATHS and v}


def _reconcile(doc: Settings) -> Settings:
    """Secrets on disk win: their {set, last4} must match settings."""
    if not _secrets:
        return doc
    data = doc.model_dump(by_alias=True, mode="json")
    for name, value in _secrets.items():
        _set_at(data, SECRET_PATHS[name], {"set": True, "last4": value[-4:]})
    return Settings.model_validate(data)


def _persisted(value: Any) -> Any:
    """Drop live fields (at any depth) from a snake_case dump."""
    if isinstance(value, dict):
        return {k: _persisted(v) for k, v in value.items() if k not in LIVE_FIELDS}
    if isinstance(value, list):
        return [_persisted(v) for v in value]
    return value


def _write_settings() -> None:
    """Rewrite only the part files whose persisted content changed."""
    data = get_settings().model_dump(mode="json")
    for part, (path, _) in PARTS.items():
        text = storage.dumps(_persisted(_get_at(data, path)))
        if _disk.get(part) != text:
            storage.write_text(_part_file(part), text)
            _disk[part] = text


def _write_secrets() -> None:
    text = SECRETS_HEADER + (storage.dumps(_secrets) if _secrets else "")
    storage.write_text(SECRETS_FILE, text, private=True)


def get_settings() -> Settings:
    return _doc["current"]


def _dump() -> dict[str, Any]:
    return get_settings().model_dump(by_alias=True, mode="json")


def _save(data: dict[str, Any]) -> Settings:
    _doc["current"] = Settings.model_validate(data)
    _write_settings()
    bus.publish("settings.updated", _doc["current"])
    return _doc["current"]


# --- PATCH ------------------------------------------------------------------


def _key(current: dict[str, Any], key: str) -> str | None:
    """Match a camelCase or snake_case input key to an existing field."""
    for k in current:
        if k == key or to_snake(k) == key:
            return k
    return None


def _merge(current: dict[str, Any], patch: dict[str, Any], skip: set[str]) -> dict[str, Any]:
    out = dict(current)
    for raw, value in patch.items():
        k = _key(current, raw)
        if k is None or k in READ_ONLY or k in skip:
            continue  # unknown and read-only fields are ignored
        if k == "events" and isinstance(value, list):
            out[k] = _merge_events(current[k], value)
        elif isinstance(current[k], dict) and isinstance(value, dict):
            out[k] = _merge(current[k], value, set())
        else:
            out[k] = value
    return out


def _merge_events(current: list[dict], patch: list[Any]) -> list[dict]:
    """Only `on` is editable; events are matched by key."""
    by_key = {e["key"]: dict(e) for e in current}
    errors = []
    for i, e in enumerate(patch):
        key = e.get("key") if isinstance(e, dict) else None
        if key not in by_key:
            errors.append({"loc": ["body", "events", i, "key"], "msg": f"unknown event '{key}'"})
        elif "on" in e:
            by_key[key]["on"] = e["on"]
    if errors:
        raise ApiError(422, "Settings are invalid", {"errors": errors})
    return list(by_key.values())


def patch_section(section: str, body: dict[str, Any]) -> Settings:
    if section not in SECTIONS:
        raise not_found("Settings section", section)
    version = body.get("version")
    if not isinstance(version, int) or isinstance(version, bool):
        err = {"loc": ["body", "version"], "msg": "version is required"}
        raise ApiError(422, "Settings are invalid", {"errors": [err]})
    data = _dump()
    if version != data["version"]:
        raise conflict("Settings were changed by someone else", current=data)

    fields = {k: v for k, v in body.items() if k != "version"}
    merged = _merge(data[section], fields, READ_ONLY_IN.get(section, set()))
    try:
        SECTIONS[section].model_validate(merged)
    except ValidationError as e:
        errors = [{"loc": ["body", *err["loc"]], "msg": err["msg"]} for err in e.errors()]
        raise ApiError(422, "Settings are invalid", {"errors": errors})
    data[section] = merged
    data["version"] += 1
    saved = _save(data)
    if section == "training":
        _apply_sim_envs_path(merged.get("simEnvsPath"))
    return saved


def _apply_sim_envs_path(value: str | None) -> None:
    """Point the simulation scanner at the new folder and rescan."""
    if not value:
        return
    config.sim_envs_dir = resolve_user_path(value)
    from app.services import simulation  # late import: simulation reads models/tasks

    simulation.rescan()


# --- secrets ----------------------------------------------------------------


def _get_at(data: dict[str, Any], path: tuple[str, ...]) -> Any:
    for part in path:
        data = data[part]
    return data


def _set_at(data: dict[str, Any], path: tuple[str, ...], value: Any) -> None:
    for part in path[:-1]:
        data = data[part]
    data[path[-1]] = value


def _set_state(data: dict[str, Any], path: tuple[str, ...], state: str) -> None:
    # Integration states reset when their key changes
    parent = data
    for part in path[:-1]:
        parent = parent[part]
    if "state" in parent:
        parent["state"] = state


def put_secret(name: SecretName, value: str) -> Secret:
    _secrets[name] = value
    _write_secrets()
    secret = Secret(set=True, last4=value[-4:])
    _write_secret(name, secret)
    return secret


def delete_secret(name: SecretName) -> Secret:
    _secrets.pop(name, None)
    _write_secrets()
    secret = Secret(set=False)
    _write_secret(name, secret)
    return secret


def _write_secret(name: str, secret: Secret) -> None:
    # Secret writes do not bump the document version (PATCH ignores secrets)
    data = _dump()
    path = SECRET_PATHS[name]
    _set_at(data, path, secret.model_dump(exclude_none=True))
    _set_state(data, path, "unknown")
    _save(data)


def has_secret(name: str) -> bool:
    data: Any = _dump()
    for part in SECRET_PATHS[name]:
        data = data[part]
    return bool(data["set"])


# --- connection tests -------------------------------------------------------


def run_test(target: str) -> ConnTestResult:
    """Mock check: integrations need their secret; station endpoints always answer."""
    secret = TARGET_SECRET.get(target)
    if secret and not has_secret(secret):
        result = ConnTestResult(state="error", detail=f"{secret} is not set")
    else:
        result = ConnTestResult(state="ok", latency_ms=LATENCY_MS.get(target))

    data = _dump()
    if target in data["integrations"]:
        data["integrations"][target]["state"] = result.state
    elif target in data["connection"]:
        conn = data["connection"][target]
        conn["state"] = result.state
        if "url" in conn:
            conn["latencyMs"] = result.latency_ms
    _save(data)
    return result


# --- read-only info ---------------------------------------------------------


def disk() -> Disk:
    return Disk.model_validate(load("settings", "DISK"))


def shortcuts() -> list[ShortcutGroup]:
    return [ShortcutGroup.model_validate(g) for g in load("settings", "SHORTCUTS")]


def versions() -> list[VersionRow]:
    return [VersionRow.model_validate(v) for v in load("settings", "VERSIONS")]


reset()

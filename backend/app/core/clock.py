"""Station time helpers."""

from datetime import datetime
from zoneinfo import ZoneInfo

from app.configs.config import config


def now() -> datetime:
    return datetime.now(ZoneInfo(config.timezone))


def now_iso() -> str:
    return now().isoformat(timespec="seconds")


def iso(local: str) -> str:
    """Mock helper: "2026-10-02 14:05" → ISO 8601 in the station timezone."""
    dt = datetime.strptime(local, "%Y-%m-%d %H:%M").replace(tzinfo=ZoneInfo(config.timezone))
    return dt.isoformat(timespec="seconds")

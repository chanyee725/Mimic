"""Station time: timezone-aware now, ISO 8601 strings, and a clock tests can replace."""

from collections.abc import Callable
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from app.configs.config import config

_override: Callable[[], datetime] | None = None


def tz() -> ZoneInfo:
    return ZoneInfo(config.timezone)


def set_clock(fn: Callable[[], datetime] | None = None) -> None:
    """Tests inject a fake clock; None restores the real one."""
    global _override
    _override = fn


def now() -> datetime:
    return _override() if _override else datetime.now(tz())


def to_iso(dt: datetime, ms: bool = False) -> str:
    return dt.isoformat(timespec="milliseconds" if ms else "seconds")


def now_iso(ms: bool = False) -> str:
    return to_iso(now(), ms)


def parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value)


def iso(local: str) -> str:
    """Seed helper: "2026-10-02", "2026-10-02 14:05" or ISO → ISO 8601 in the station timezone."""
    if "T" in local:
        return local
    fmt = "%Y-%m-%d %H:%M" if " " in local else "%Y-%m-%d"
    return to_iso(datetime.strptime(local, fmt).replace(tzinfo=tz()))


def from_timestamp(ts: float) -> str:
    """POSIX timestamp (e.g. a file mtime) → ISO 8601 in the station timezone."""
    return to_iso(datetime.fromtimestamp(ts, tz()))


def seconds_since(start: datetime, end: datetime | None = None) -> float:
    return ((end or now()) - start).total_seconds()


def today() -> date:
    return now().date()


def week_start(day: date) -> date:
    """Sunday on or before day."""
    return day - timedelta(days=(day.weekday() + 1) % 7)


def days(start: date, end: date) -> list[date]:
    """Every day from start to end, both inclusive."""
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]

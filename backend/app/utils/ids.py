"""Id helpers: sequential ids ("job_007"), slugs, comma lists."""

import re
from collections.abc import Iterable


def seq_num(item_id: str) -> int:
    """Trailing number after the last "_" ("sim_012" → 12), 0 when there is none."""
    tail = item_id.rsplit("_", 1)[-1]
    return int(tail) if tail.isdigit() else 0


def next_seq_id(prefix: str, existing: Iterable[str], width: int = 3) -> str:
    """Next "<prefix>_NNN" after the highest existing one with the same prefix."""
    pattern = re.compile(rf"{re.escape(prefix)}_(\d+)")
    n = max((int(m.group(1)) for i in existing if (m := pattern.fullmatch(i))), default=0)
    return f"{prefix}_{n + 1:0{width}d}"


def slugify(text: str, sep: str = "-") -> str:
    """Lowercase ASCII letters and digits joined by sep ("RTX 4090" → "rtx-4090")."""
    return re.sub(r"[^a-z0-9]+", sep, text.lower()).strip(sep)


def split_csv(value: str | None) -> list[str]:
    """ "a, b,,c" → ["a", "b", "c"]."""
    return [s.strip() for s in (value or "").split(",") if s.strip()]

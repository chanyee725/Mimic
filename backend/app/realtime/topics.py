"""Event type → WebSocket topic mapping (docs/api/realtime.md)."""

# Event type prefix (before the first ".") → topic
PREFIX_TOPICS: dict[str, str] = {
    "capture": "capture",
    "recording": "recordings",
    "dataset": "datasets",
    "training": "training",
    "evaluate": "evaluate",
    "sim": "sim",
    "device": "devices",
    "station": "station",
}

TOPICS: tuple[str, ...] = tuple(dict.fromkeys(PREFIX_TOPICS.values()))


def topic_of(event_type: str) -> str | None:
    """`training.updated` → `training`; unknown prefixes → None."""
    return PREFIX_TOPICS.get(event_type.split(".", 1)[0])


def parse_topics(raw: str | None) -> tuple[list[str], list[str]]:
    """`?topics=training,sim` → (accepted, unknown). Missing or empty means every topic."""
    names = [t.strip() for t in (raw or "").split(",") if t.strip()]
    if not names:
        return list(TOPICS), []
    accepted = [t for t in TOPICS if t in names]
    unknown = sorted({t for t in names if t not in TOPICS})
    return accepted, unknown

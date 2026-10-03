"""Shared schema base: snake_case in Python, camelCase on the wire."""

from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

T = TypeVar("T")


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class Page(CamelModel, Generic[T]):
    items: list[T]
    next_cursor: str | None = None
    total: int


def paginate(items: list[T], limit: int, cursor: str | None) -> Page[T]:
    """Cursor = stringified offset (opaque to clients)."""
    start = int(cursor) if cursor and cursor.isdigit() else 0
    chunk = items[start : start + limit]
    nxt = start + limit
    return Page[T](
        items=chunk, next_cursor=str(nxt) if nxt < len(items) else None, total=len(items)
    )

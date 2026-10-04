"""Shared request dependencies and parameter types for the routers."""

from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Query


@dataclass(frozen=True)
class PageParams:
    limit: int
    cursor: str | None


def _page_params(
    limit: Annotated[int, Query(ge=1, le=500)] = 50, cursor: str | None = None
) -> PageParams:
    return PageParams(limit, cursor)


# Cursor paging: ?limit=1..500 (default 50)&cursor=
Pagination = Annotated[PageParams, Depends(_page_params)]
# Optional ?taskId= filter
TaskIdFilter = Annotated[str | None, Query(alias="taskId")]

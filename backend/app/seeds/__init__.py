"""Mock data exported from web/src/dummy (regenerate with docs in backend/README.md)."""

import copy
import json
from functools import cache
from pathlib import Path
from typing import Any

_DIR = Path(__file__).parent / "data"


@cache
def _raw(name: str) -> dict[str, Any]:
    return json.loads((_DIR / f"{name}.json").read_text())


def load(name: str, key: str) -> Any:
    """Deep copy of one exported value, e.g. load("settings", "SHORTCUTS")."""
    return copy.deepcopy(_raw(name)[key])

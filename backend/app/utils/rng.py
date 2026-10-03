"""Deterministic randomness for mock signals, bit-exact with the web versions."""

import zlib
from collections.abc import Callable

_M32 = 0xFFFFFFFF


def _imul(a: int, b: int) -> int:
    return (a * b) & _M32


def mulberry32(seed: int) -> Callable[[], float]:
    """Returns a generator of floats in [0, 1)."""
    a = seed & _M32

    def rand() -> float:
        nonlocal a
        a = (a + 0x6D2B79F5) & _M32
        t = a
        t = _imul(t ^ (t >> 15), t | 1)
        t ^= (t + _imul(t ^ (t >> 7), t | 61)) & _M32
        return ((t ^ (t >> 14)) & _M32) / 4294967296

    return rand


def hash_seed(text: str) -> int:
    """32-bit string hash (h = h * 31 + c, starting at 7)."""
    h = 7
    for c in text:
        h = (h * 31 + ord(c)) & _M32
    return h


def unit_seed(text: str) -> float:
    """Stable value in [0, 1) per string (crc32)."""
    return zlib.crc32(text.encode()) / 2**32

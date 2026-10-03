"""Deterministic mock joint signal, same as web components/robot/joint-plots.tsx."""

import math

Y_MAX = 90.0  # degrees
STATE_LAG_S = 0.15  # follower trails the leader


def sample(i: int, t: float, seed: float = 0.0) -> float:
    """Angle (degrees) of joint i at time t (seconds)."""
    return (
        math.sin(t * (0.55 + (i % 6) * 0.22) + i + seed * 6) * 0.7
        + math.sin(t * 2.7 + i + seed) * 0.08
    ) * Y_MAX


def joint_frame(n_joints: int, t: float) -> tuple[list[float], list[float]]:
    """(action, state) for every joint at time t."""
    action = [sample(i, t) for i in range(n_joints)]
    state = [sample(i, t - STATE_LAG_S) for i in range(n_joints)]
    return action, state


def measured_rate(target_hz: float, t: float, phase: float = 0.0) -> float:
    """Mock measured rate: slightly under target with a small deterministic wobble."""
    return target_hz * (0.997 + 0.002 * math.sin(t * 0.7 + phase))

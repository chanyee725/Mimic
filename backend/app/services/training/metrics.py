"""Per-step training metrics (mock, ported from web features/training/lib/run.ts).

The real backend fills them from lerobot-train step logs (loss, grad_norm, lr, update_s, data_s)
and nvidia-smi. The same job id always gets the same curves.
"""

import math

from app.utils.rng import hash_seed, mulberry32

SERIES = ("loss_raw", "loss", "grad_norm", "lr", "update_s", "data_s", "gpu_util", "gpu_mem")

PEAK_LR = 1e-4
DECAY_LR = 2.5e-6
WARMUP = 1000
DECAY_STEPS = 30000


class Run:
    """Logged steps 0..count-1 of one job, filled lazily."""

    def __init__(self, job_id: str, gpu: str, total: int) -> None:
        self.total = total
        self.data: dict[str, list[float]] = {k: [] for k in SERIES}
        self._rand = mulberry32(hash_seed(job_id))
        self._big = "A100" in gpu or "H100" in gpu
        self._ema = 0.0

    @property
    def count(self) -> int:
        return len(self.data["loss"])

    def advance_to(self, target: int) -> None:
        for s in range(self.count, min(target, self.total)):
            self._step(s)

    def _step(self, s: int) -> None:
        rand, d, big = self._rand, self.data, self._big

        def noise() -> float:
            return rand() - 0.5

        raw = max(
            0.01,
            0.06 + 0.95 * math.exp(-s / 2800) + noise() * (0.04 + 0.12 * math.exp(-s / 4000)),
        )
        self._ema = raw if s == 0 else self._ema + 0.02 * (raw - self._ema)
        if s < WARMUP:
            lr = PEAK_LR * (s + 1) / WARMUP
        else:
            phase = math.pi * min(s - WARMUP, DECAY_STEPS) / DECAY_STEPS
            lr = DECAY_LR + (PEAK_LR - DECAY_LR) * 0.5 * (1 + math.cos(phase))
        spike = rand() < 0.004
        d["loss_raw"].append(raw)
        d["loss"].append(self._ema)
        grad = 0.35 + 2.4 * math.exp(-s / 2400) + abs(noise()) * 0.4
        d["grad_norm"].append(grad + (2 + rand() * 3 if spike else 0))
        d["lr"].append(lr)
        d["update_s"].append((0.52 if big else 0.78) + noise() * 0.06)
        data_s = 0.035 + abs(noise()) * 0.02 + (0.2 + rand() * 0.3 if rand() < 0.01 else 0)
        d["data_s"].append(data_s)
        d["gpu_util"].append(min(100, 93 + noise() * 8 - (25 if data_s > 0.1 else 0)))
        d["gpu_mem"].append((38.2 if big else 19.6) + noise() * 0.3)


def bucket(values: list[float], every: int) -> list[float]:
    """Averages consecutive groups of `every` values (the last group may be shorter)."""
    out = []
    for i in range(0, len(values), every):
        chunk = values[i : i + every]
        out.append(round(sum(chunk) / len(chunk), 8))
    return out

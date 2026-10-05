"""Parsing of lerobot-train output (lerobot 0.6): tqdm progress, metric lines, checkpoints.

The log mixes `\\r`-separated tqdm updates and logging lines, so callers split on both.
"""

import re
from dataclasses import dataclass

# "Training:  25%|██▌       | 5/20 [00:13<00:20,  1.35s/step]" (rate as step/s or s/step)
_TQDM = re.compile(
    r"Training:\s+\d+%\|[^|]*\|\s*(\d+)/(\d+)\s+\[([\d:]+)<([\d:?]+),\s*([\d.?]+)\s*(step/s|s/step)"
)
# MetricsTracker line: "step:5 smpl:20 ep:0 epch:0.00 loss:1.352 grdn:22.191 lr:9.4e-05 …"
_TRACKER = re.compile(r"\bstep:\S+ smpl:\S+ ep:\S+ epch:(\S+) (.*)$")
_CHECKPOINT = re.compile(r"Checkpoint policy after step (\d+)")
END = "End of training"

# Tracker names → metric series (gpu_util comes from nvidia-smi, loss is smoothed by the caller)
_SERIES = {
    "loss": "loss_raw",
    "grdn": "grad_norm",
    "lr": "lr",
    "updt_s": "update_s",
    "data_s": "data_s",
    "mem_gb": "gpu_mem",
}


@dataclass
class Progress:
    step: int
    total: int
    elapsed_s: int
    eta_s: int | None
    steps_per_s: float | None


@dataclass
class TrackerLine:
    epoch: float
    values: dict[str, float]


def _clock(text: str) -> int | None:
    """ "01:02:03" / "02:03" → seconds; None for "?"."""
    if "?" in text:
        return None
    s = 0
    for part in text.split(":"):
        s = s * 60 + int(part)
    return s


def progress(line: str) -> Progress | None:
    m = _TQDM.search(line)
    if not m:
        return None
    n, total, elapsed, eta, rate, unit = m.groups()
    sps = None
    if "?" not in rate and float(rate) > 0:
        sps = float(rate) if unit == "step/s" else 1 / float(rate)
    return Progress(int(n), int(total), _clock(elapsed) or 0, _clock(eta), sps)


def tracker(line: str) -> TrackerLine | None:
    m = _TRACKER.search(line)
    if not m:
        return None
    values = {}
    for token in m.group(2).split():
        key, _, value = token.partition(":")
        if key in _SERIES:
            try:
                values[_SERIES[key]] = float(value)
            except ValueError:
                pass
    try:
        epoch = float(m.group(1))
    except ValueError:
        epoch = 0.0
    return TrackerLine(epoch, values)


def checkpoint(line: str) -> int | None:
    m = _CHECKPOINT.search(line)
    return int(m.group(1)) if m else None


def error_line(lines: list[str]) -> str | None:
    """Last exception-looking line of a failed run (e.g. "torch.OutOfMemoryError: …")."""
    for line in reversed(lines):
        text = line.strip()
        if re.match(r"^[\w.]+(Error|Exception|Interrupt)\b", text):
            return text[:500]
    return None

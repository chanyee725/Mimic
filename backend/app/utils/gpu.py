"""Local NVIDIA GPUs from nvidia-smi ([] when the tool or a GPU is missing)."""

import logging
import subprocess
from dataclasses import dataclass
from functools import cache

log = logging.getLogger(__name__)

QUERY = ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"]
TIMEOUT_S = 5


@dataclass(frozen=True)
class Gpu:
    id: str  # "cuda:0"
    name: str  # "NVIDIA GeForce RTX 4090"
    vram: str  # "24 GB"


def parse(output: str) -> list[Gpu]:
    """Lines like "NVIDIA GeForce RTX 4090, 24564" (MiB) → GPUs in device order."""
    gpus = []
    for line in output.strip().splitlines():
        name, _, mib = line.rpartition(",")
        try:
            gb = round(float(mib) / 1024)
        except ValueError:
            continue
        gpus.append(Gpu(id=f"cuda:{len(gpus)}", name=name.strip(), vram=f"{gb} GB"))
    return gpus


def query() -> str | None:
    try:
        r = subprocess.run(QUERY, capture_output=True, text=True, timeout=TIMEOUT_S, check=True)
    except (OSError, subprocess.SubprocessError) as e:
        log.info("No NVIDIA GPU detected: %s", e)
        return None
    return r.stdout


@cache
def detect() -> tuple[Gpu, ...]:
    """Detected once per process (GPUs do not change while the backend runs)."""
    out = query()
    return tuple(parse(out)) if out else ()


def utilization(index: int) -> float | None:
    """Current utilization (%) of GPU `index`; None when nvidia-smi does not answer."""
    cmd = [
        "nvidia-smi",
        "--query-gpu=utilization.gpu",
        "--format=csv,noheader,nounits",
        f"--id={index}",
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=TIMEOUT_S, check=True)
        return float(r.stdout.strip())
    except (OSError, subprocess.SubprocessError, ValueError):
        return None

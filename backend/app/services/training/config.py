"""Training options (seeds/data/training.json): policy, RunPod catalogue, pricing, train command."""

import math

from app.schemas.training import PriceFactor, RunPodGpu, RunPodOptions, RunPodVolume
from app.seeds import load
from app.services import datasets
from app.services.training import params


def raw(key: str):
    return load("training", key)


def policy() -> str:
    return raw("POLICY")


def policy_base() -> str:
    return raw("POLICY_BASE")


def runpod_gpus() -> list[RunPodGpu]:
    return [RunPodGpu.model_validate(g) for g in raw("RUNPOD_GPUS")]


def runpod_regions() -> list[str]:
    return raw("RUNPOD_REGIONS")


def runpod_volumes() -> list[RunPodVolume]:
    return [RunPodVolume.model_validate(v) for v in raw("RUNPOD_VOLUMES")]


def runpod_defaults() -> RunPodOptions:
    return RunPodOptions.model_validate(raw("RUNPOD_DEFAULTS"))


def price_factor() -> PriceFactor:
    return PriceFactor.model_validate(raw("RUNPOD_PRICE_FACTOR"))


def runpod_rate(base: float, o: RunPodOptions) -> float:
    f = price_factor()
    return base * o.gpu_count * f.cloud[o.cloud] * f.pricing[o.pricing]


def runpod_cap_hours(o: RunPodOptions, rate: float) -> float:
    """Hours until the max runtime or the budget is hit (0 = no limit)."""
    if o.budget:
        return min(o.max_hours or math.inf, o.budget / rate)
    return o.max_hours


def trainable_datasets() -> list[str]:
    return [
        d.repo_id for d in datasets.list_datasets() if d.kind == "lerobot" and d.status == "ready"
    ]


def build_command(dataset: str, overrides: dict) -> str:
    flags = params.override_flags(overrides)
    head = [
        "lerobot-train",
        f"--policy.path={policy_base()}",
        f"--dataset.repo_id={dataset}",
        "--policy.device=cuda",
    ]
    return " ".join(head + flags)

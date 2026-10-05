"""Training options (seeds/data/training.json): policy, RunPod catalogue, pricing, train command."""

import json
import math
import shlex

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


# SmolVLA base takes up to three cameras named camera1..3
POLICY_CAMERAS = 3


def camera_keys(dataset: str) -> list[str]:
    """Image / video features of the dataset in feature order (meta/info.json)."""
    info = datasets.folder(dataset) / "meta" / "info.json"
    try:
        features = json.loads(info.read_text())["features"]
    except (OSError, ValueError, KeyError):
        return []
    return [k for k, f in features.items() if f.get("dtype") in ("video", "image")]


def rename_map(dataset: str) -> dict[str, str]:
    """observation.images.<key> → observation.images.camera<n>, the names smolvla_base was trained with."""
    return {k: f"observation.images.camera{i + 1}" for i, k in enumerate(camera_keys(dataset))}


def train_args(dataset: str, overrides: dict, run: dict[str, str] | None = None) -> list[str]:
    """lerobot-train arguments (no program name). `run` adds the job's paths (output_dir, …)."""
    args = [
        f"--policy.path={policy_base()}",
        f"--dataset.repo_id={dataset}",
        f"--dataset.root={datasets.folder(dataset)}",
        "--policy.device=cuda",
        "--policy.push_to_hub=false",
        "--wandb.enable=false",
    ]
    args += [f"--{k}={v}" for k, v in (run or {}).items()]
    args += params.override_flags(overrides)
    if names := rename_map(dataset):
        args.append(f"--rename_map={json.dumps(names)}")
    return args


def build_command(dataset: str, overrides: dict, run: dict[str, str] | None = None) -> str:
    return shlex.join(["lerobot-train", *train_args(dataset, overrides, run)])

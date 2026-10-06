"""Training options (seeds/data/training.json): policy, RunPod catalogue, pricing, train command."""

import json
import logging
import math
import shlex
import time
from typing import Any

from app.schemas.training import PriceFactor, RunPodGpu, RunPodOptions, RunPodVolume
from app.seeds import load
from app.services import datasets
from app.services.training import params

log = logging.getLogger(__name__)


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


VOLUMES_TTL_S = 60
_volumes: tuple[float, list[dict[str, Any]]] = (0.0, [])


def account_volumes() -> list[dict[str, Any]]:
    """The RunPod account's network volumes (cached a minute; [] without a key or on errors)."""
    global _volumes
    from app.core.errors import ApiError
    from app.services.training import runpod_api

    if not runpod_api.key_set():
        return []
    at, cached = _volumes
    if time.monotonic() - at < VOLUMES_TTL_S:
        return cached
    try:
        vols = runpod_api.network_volumes()
    except ApiError as e:
        log.warning("RunPod network volumes: %s", e.message)
        vols = cached
    _volumes = (time.monotonic(), vols)
    return vols


def network_volume(volume_id: str) -> dict[str, Any] | None:
    return next((v for v in account_volumes() if v.get("id") == volume_id), None)


def runpod_volumes() -> list[RunPodVolume]:
    """ "none" from the seeds, then the account's network volumes."""
    out = [RunPodVolume.model_validate(v) for v in raw("RUNPOD_VOLUMES")]
    for v in account_volumes():
        out.append(
            RunPodVolume(
                id=v["id"],
                label=f"{v.get('name') or v['id']} ({v.get('size', '?')} GB, {v.get('dataCenterId', '?')})",
                note="데이터셋 · LeRobot 설치를 pod 사이에 재사용합니다",
            )
        )
    return out


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


def train_args(
    dataset: str,
    overrides: dict,
    run: dict[str, str] | None = None,
    repo_id: str | None = None,
    root: str | None = None,
) -> list[str]:
    """lerobot-train arguments (no program name). `run` adds the job's paths (output_dir, …);
    `repo_id` / `root` replace the local dataset (a RunPod job's Hub copy)."""
    args = [
        f"--policy.path={policy_base()}",
        f"--dataset.repo_id={repo_id or dataset}",
        f"--dataset.root={root or datasets.folder(dataset)}",
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

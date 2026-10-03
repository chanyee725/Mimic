"""lerobot-train parameters (ported from web features/training/lib/params.ts).

key is the CLI flag name as is (--key=value). Defaults follow lerobot TrainPipelineConfig /
SmolVLAConfig; verify them against the pinned lerobot version.
"""

from app.schemas.training import Param, ParamGroup, ParamValue


def _p(key: str, label: str, default: ParamValue, hint: str | None = None) -> Param:
    return Param(key=key, label=label, default=default, hint=hint)


PARAM_GROUPS: list[ParamGroup] = [
    ParamGroup(
        title="Training",
        params=[
            _p("steps", "Steps", 100000),
            _p("batch_size", "Batch size", 8, "줄이면 GPU 메모리를 덜 씁니다"),
            _p("seed", "Seed", 1000),
            _p("num_workers", "Data loader workers", 4),
        ],
    ),
    ParamGroup(
        title="Optimizer",
        params=[
            _p("policy.optimizer_lr", "Learning rate", "1e-4"),
            _p("policy.optimizer_weight_decay", "Weight decay", "1e-10"),
            _p("policy.optimizer_grad_clip_norm", "Grad clip norm", 10),
        ],
    ),
    ParamGroup(
        title="Scheduler",
        params=[
            _p("policy.scheduler_warmup_steps", "Warmup steps", 1000),
            _p("policy.scheduler_decay_steps", "Decay steps", 30000),
            _p("policy.scheduler_decay_lr", "Final learning rate", "2.5e-6"),
        ],
    ),
    ParamGroup(
        title="Policy",
        params=[
            _p("policy.chunk_size", "Action chunk size", 50),
            _p("policy.n_action_steps", "Action steps per inference", 50),
            _p("policy.freeze_vision_encoder", "Freeze vision encoder", True),
            _p("policy.train_expert_only", "Train action expert only", True),
            _p("policy.use_amp", "Mixed precision (AMP)", False),
        ],
    ),
    ParamGroup(
        title="Checkpoints and logging",
        params=[
            _p("save_freq", "Save every (steps)", 20000),
            _p("log_freq", "Log every (steps)", 200),
            _p("wandb.enable", "Log to Weights & Biases", False),
        ],
    ),
]

DEFAULTS: dict[str, ParamValue] = {p.key: p.default for g in PARAM_GROUPS for p in g.params}
_POSITIVE = {"steps", "batch_size", "save_freq", "log_freq"}


def check_overrides(overrides: dict[str, ParamValue]) -> list[dict[str, str]]:
    """Field errors for unknown keys or values whose type does not match the default."""
    errors = []
    for key, value in overrides.items():
        if key not in DEFAULTS:
            errors.append({"loc": ["body", "overrides", key], "msg": "Unknown parameter"})
            continue
        default = DEFAULTS[key]
        if isinstance(default, bool):
            ok = isinstance(value, bool)
        elif isinstance(default, int):
            low = 1 if key in _POSITIVE else 0
            ok = isinstance(value, int) and not isinstance(value, bool) and value >= low
        else:
            ok = not isinstance(value, bool) and _is_number(value)
        if not ok:
            errors.append({"loc": ["body", "overrides", key], "msg": "Invalid value"})
    return errors


def _is_number(value: ParamValue) -> bool:
    try:
        float(value)
    except (TypeError, ValueError):
        return False
    return True


def _fmt(value: ParamValue) -> str:
    return str(value).lower() if isinstance(value, bool) else str(value)


def override_flags(overrides: dict[str, ParamValue]) -> list[str]:
    """CLI flags for values that differ from the defaults (in parameter order)."""
    return [
        f"--{key}={_fmt(overrides[key])}"
        for key, default in DEFAULTS.items()
        if key in overrides and overrides[key] != default
    ]

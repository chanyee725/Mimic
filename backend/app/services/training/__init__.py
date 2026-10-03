"""Training: jobs, config, request validation, parameters and mock metrics.

Callers use `from app.services import training` and the functions below. Note that
`training.metrics` is the metrics() function; the module is `app.services.training.metrics`.
"""

from app.services.training.jobs import (
    ACTIVE,
    CHECKPOINT_MB,
    create_job,
    download_checkpoint,
    get_checkpoint,
    get_config,
    get_job,
    job_command,
    list_jobs,
    local_gpus,
    loss_at,
    metrics,
    preview,
    push_checkpoint,
    reset,
    save_checkpoint,
    stop_job,
    terminate_pod,
)

__all__ = [
    "ACTIVE",
    "CHECKPOINT_MB",
    "create_job",
    "download_checkpoint",
    "get_checkpoint",
    "get_config",
    "get_job",
    "job_command",
    "list_jobs",
    "local_gpus",
    "loss_at",
    "metrics",
    "preview",
    "push_checkpoint",
    "reset",
    "save_checkpoint",
    "stop_job",
    "terminate_pod",
]

reset()

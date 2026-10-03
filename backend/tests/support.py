"""Test helpers that write real files into the per-test data folder (no capture session needed)."""

from pathlib import Path

import yaml

from app.configs.config import config
from app.models.recordings import Recording, SubtaskSpan
from app.services import models, recordings
from app.services.recordings import mcap_io

JOINTS = ["shoulder_pan", "shoulder_lift", "elbow_flex", "wrist_flex", "wrist_roll", "gripper"]
START_NS = 1_790_000_000_000_000_000


def write_recording(
    episode: int,
    task_id: str = "stack-two-blocks",
    duration_s: float = 2.0,
    review: str = "accepted",
    joints: list[str] | None = None,
    hz: float = 60,
    subtasks: list[SubtaskSpan] | None = None,
) -> Recording:
    """An episode MCAP + sidecar under <raw>/<task>/ep_NNNN, like Capture writes them."""
    joints = joints or JOINTS
    if subtasks is None:
        half = round(duration_s / 2, 3)
        subtasks = [
            SubtaskSpan(name="reach", start_s=0, end_s=half),
            SubtaskSpan(name="grasp", start_s=half, end_s=duration_s),
        ]
    ep = mcap_io.Episode(
        start_ns=START_NS + episode * 10**9,
        duration_s=duration_s,
        hz=hz,
        joints=joints,
        seed=episode / 100,
        subtasks=subtasks,
        metadata={"task_id": task_id, "episode": str(episode)},
    )
    rec = Recording(
        id=f"{task_id}-{episode}",
        file=f"{task_id}/ep_{episode:04d}.mcap",
        source="capture",
        task_id=task_id,
        rig_id="so101-kit",
        episode=episode,
        recorded_at=f"2026-10-01T10:{episode % 60:02d}:00+09:00",
        duration_s=duration_s,
        size_mb=0,
        outcome="success",
        review=review,
        topics=mcap_io.topics(ep),
        subtasks=subtasks,
        drops=[],
        checks=[],
    )
    return recordings.save_episode(rec, ep)


def write_model(
    model_id: str, task_id: str = "stack-two-blocks", saved_at: str = "2026-10-01T12:00:00+09:00"
) -> Path:
    """A model folder (model.yaml + checkpoint files) under config.models_dir; reindexes models."""
    d = config.models_dir / model_id
    (d / "pretrained_model").mkdir(parents=True)
    (d / "pretrained_model" / "config.json").write_text('{"type": "smolvla"}')
    (d / "pretrained_model" / "model.safetensors").write_bytes(b"\0" * 2_000_000)
    meta = {
        "name": f"Model {model_id}",
        "task_id": task_id,
        "dataset": "local/stack",
        "job_id": "job_001",
        "step": 20000,
        "loss": 0.05,
        "saved_at": saved_at,
        "hub_repo": None,
        "evals": [],
    }
    (d / "model.yaml").write_text(yaml.safe_dump(meta))
    models.reset()
    return d

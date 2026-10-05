"""Policy inference for Evaluate: a saved model's pretrained_model/ loaded with LeRobot.

The last loaded model stays on the GPU, so trials after the first start at once. Tests swap
`load` for a fake.
"""

import logging
import threading
from pathlib import Path
from typing import Protocol

log = logging.getLogger(__name__)


class Policy(Protocol):
    def reset(self) -> None:
        """Clears the action queue before a new trial."""
        ...

    def act(self, images: dict[str, bytes], state: list[float], task: str) -> list[float]:
        """One action (rig joint order) from a JPEG per camera key, the joint state and the instruction."""
        ...


class LeRobotPolicy:
    def __init__(self, path: Path):
        import torch
        from lerobot.configs.policies import PreTrainedConfig
        from lerobot.policies.factory import get_policy_class, make_pre_post_processors

        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        cfg = PreTrainedConfig.from_pretrained(path)
        cfg.device = self.device.type
        self.cfg = cfg
        self.policy = get_policy_class(cfg.type).from_pretrained(path, config=cfg)
        self.policy.eval()
        self.pre, self.post = make_pre_post_processors(
            cfg,
            pretrained_path=str(path),
            preprocessor_overrides={"device_processor": {"device": self.device.type}},
        )

    def reset(self) -> None:
        self.policy.reset()
        self.pre.reset()
        self.post.reset()

    def act(self, images: dict[str, bytes], state: list[float], task: str) -> list[float]:
        import cv2
        import numpy as np
        from lerobot.common.control_utils import predict_action

        obs = {"observation.state": np.asarray(state, dtype=np.float32)}
        for key, jpeg in images.items():
            bgr = cv2.imdecode(np.frombuffer(jpeg, np.uint8), cv2.IMREAD_COLOR)
            if bgr is None:
                raise ValueError(f"Camera '{key}' sent an unreadable frame")
            # The preprocessor renames these to the camera1..3 the model was trained with
            obs[f"observation.images.{key}"] = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        action = predict_action(
            obs, self.policy, self.device, self.pre, self.post, self.cfg.use_amp, task=task
        )
        return [float(v) for v in action.squeeze(0).tolist()]


_lock = threading.Lock()
_loaded: tuple[str, Policy] | None = None


def load(model_id: str, path: Path) -> Policy:
    """The model's policy, loading it (and dropping the previous one) when it is not cached."""
    global _loaded
    with _lock:
        if _loaded and _loaded[0] == model_id:
            return _loaded[1]
        _unload()
        policy = LeRobotPolicy(path)
        _loaded = (model_id, policy)
        return policy


def _unload() -> None:
    global _loaded
    if _loaded is None:
        return
    _loaded = None
    try:
        import torch

        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except ImportError:
        pass


def forget(model_id: str | None = None) -> None:
    """Drops the cached policy (all, or only when it is `model_id`)."""
    with _lock:
        if _loaded and (model_id is None or _loaded[0] == model_id):
            _unload()

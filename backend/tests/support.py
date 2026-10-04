"""Test helpers that write real files into the per-test data folder (no capture session needed)."""

import time
from fractions import Fraction
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


class FakeArm:
    """An SO-101 arm for calibration tests; positions are set by the test."""

    full_turn = ["wrist_roll"]

    def __init__(self):
        self.motors = list(JOINTS)
        self.pos = {m: 2047 for m in JOINTS}
        self.saved: tuple | None = None
        self.closed = False

    def prepare(self) -> None:
        pass

    def set_homings(self) -> dict[str, int]:
        return {m: 100 + i for i, m in enumerate(self.motors)}

    def positions(self) -> dict[str, int]:
        return dict(self.pos)

    def save(self, homings, mins, maxes) -> str:
        self.saved = (homings, dict(mins), dict(maxes))
        return "/calibration/so_follower/follower.json"

    def close(self) -> None:
        self.closed = True


def jpeg(width: int = 64, height: int = 48, shade: int = 128) -> bytes:
    """A real (tiny, flat grey) JPEG frame."""
    import av
    import numpy as np

    enc = av.CodecContext.create("mjpeg", "w")
    enc.width, enc.height, enc.pix_fmt = width, height, "yuvj420p"
    enc.time_base = Fraction(1, 30)
    rgb = np.full((height, width, 3), shade, np.uint8)
    frame = av.VideoFrame.from_ndarray(rgb, format="rgb24").reformat(format="yuvj420p")
    return bytes(enc.encode(frame)[0])


JPEG = jpeg()


class FakeDriver:
    """Stands in for LeRobot: every motor answers, cameras deliver `camera_fps`."""

    def __init__(self, calibration_dir: Path):
        from app.services.rigs.driver import ArmReport, CameraReport

        self._arm_report, self._camera_report = ArmReport, CameraReport
        self.calibration_dir = calibration_dir
        self.missing: list[str] = []
        self.camera_fps = 30.0
        self.arm = FakeArm()
        self.opened_cameras: list[str] = []
        self.released_cameras = 0
        self.frame_count: int | None = 3
        self.frame_period = 0.005
        self.teleop: FakeTeleop | None = None

    def unavailable(self):
        return None

    def calibration_file(self, hw):
        p = self.calibration_dir / f"{hw.calibration_id}.json"
        return p if p.is_file() else None

    def test_arm(self, hw):
        motors = {m: m not in self.missing for m in JOINTS}
        return self._arm_report(motors=motors, voltage=12.1, temperature=31, matches_file=None)

    def test_camera(self, hw):
        return self._camera_report(width=hw.width, height=hw.height, fps=self.camera_fps)

    def open_arm(self, hw):
        return self.arm

    def camera_frames(self, port, width, height, fps):
        self.opened_cameras.append(port)
        return self._frames()

    def _frames(self):
        """`frame_count` frames (None: until closed), one every `frame_period` seconds."""
        try:
            k = 0
            while self.frame_count is None or k < self.frame_count:
                time.sleep(self.frame_period)
                yield JPEG
                k += 1
        finally:
            self.released_cameras += 1

    def open_teleop(self, pairs):
        self.teleop = FakeTeleop([(r.id, t.id) for r, t in pairs])
        return self.teleop


FOLLOWER_LAG = 0.5


class FakeTeleop:
    """Leader positions follow `pos`; set `fail` to make the next step raise."""

    def __init__(self, pairs: list[tuple[str, str]]):
        self.pairs = pairs
        self.joints = [list(JOINTS) for _ in pairs]
        self.pos = {m: 10.0 for m in JOINTS}
        self.steps = 0
        self.fail: str | None = None
        self.closed = False

    def step(self, read_follower: bool):
        if self.fail:
            raise RuntimeError(self.fail)
        self.steps += 1
        # The follower trails the leader by FOLLOWER_LAG so the two series differ
        follower = {m: v - FOLLOWER_LAG for m, v in self.pos.items()}
        return [(dict(self.pos), dict(follower) if read_follower else None) for _ in self.pairs]

    def close(self) -> None:
        self.closed = True

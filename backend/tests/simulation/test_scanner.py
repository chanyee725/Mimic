import os
import pytest
from pathlib import Path

from app.simulation.scanner import scan_envs

MANIFEST = """\
name: Test scene
task: stack-two-blocks
description: For tests.
robot: so101
scene: scene.usd
calibrated: true
cameras:
  top: { resolution: [640, 480], fps: 30 }
  wrist: { resolution: [640, 480], fps: 30 }
action_dim: 6
episode:
  max_seconds: 30
  success: success.py:check
"""


@pytest.fixture
def root(tmp_path: Path) -> Path:
    # Separate from the autouse envs_dir copy in tmp_path/envs
    return tmp_path / "scan"


def make_env(root: Path, env_id: str, manifest: str | None = MANIFEST, files=None) -> Path:
    d = root / env_id
    d.mkdir(parents=True)
    if manifest is not None:
        (d / "env.yaml").write_text(manifest)
    for name, body in (files or {"scene.usd": "#usda 1.0\n", "success.py": "x" * 3000}).items():
        (d / name).parent.mkdir(parents=True, exist_ok=True)
        (d / name).write_text(body)
    return d


def one(root: Path):
    envs = scan_envs(root)
    assert len(envs) == 1
    return envs[0]


def test_valid_env(root: Path):
    d = make_env(root, "stack")
    (d / "assets").mkdir()
    (d / "assets" / "blocks.usd").write_text("#usda 1.0\n")
    env = one(root)
    assert env.state == "ready" and env.error is None
    assert env.id == "stack" and env.name == "Test scene"
    assert env.path == str(d.resolve())
    assert env.task_id == "stack-two-blocks" and env.description == "For tests."
    assert env.cameras == ["top", "wrist"]
    assert env.action_dim == 6 and env.max_seconds == 30 and env.calibrated is True
    assert env.manifest == MANIFEST
    files = {f.path: f.size_kb for f in env.files}
    assert files == {"assets/blocks.usd": 1, "env.yaml": 1, "scene.usd": 1, "success.py": 3}
    assert env.updated_at.startswith("20") and "+" in env.updated_at


def test_optional_keys_default(root: Path):
    text = MANIFEST.replace("task: stack-two-blocks\n", "").replace("calibrated: true\n", "")
    make_env(root, "plain", text.replace("  max_seconds: 30\n", ""))
    env = one(root)
    assert env.state == "ready"
    assert env.task_id is None and env.calibrated is False and env.max_seconds == 40


def test_json_shape(root: Path):
    make_env(root, "stack")
    data = one(root).model_dump(by_alias=True)
    assert {"taskId", "actionDim", "maxSeconds", "registeredAt", "updatedAt"} <= data.keys()
    assert data["files"][0].keys() == {"path", "sizeKB"}


def test_missing_manifest(root: Path):
    make_env(root, "empty", manifest=None)
    env = one(root)
    assert env.state == "invalid" and env.error == "env.yaml not found"
    assert env.name == "empty" and env.manifest == ""


def test_bad_yaml(root: Path):
    make_env(root, "broken", "name: [unclosed\ncameras: {top\n")
    env = one(root)
    assert env.state == "invalid"
    assert env.error.startswith("env.yaml: invalid YAML")
    assert env.manifest.startswith("name: [unclosed")


def test_not_a_mapping(root: Path):
    make_env(root, "list", "- a\n- b\n")
    assert one(root).error == "env.yaml: expected a mapping at the top level"


def test_missing_key(root: Path):
    make_env(root, "nodim", MANIFEST.replace("action_dim: 6\n", ""))
    env = one(root)
    assert env.state == "invalid" and env.error == "env.yaml: missing key 'action_dim'"


def test_missing_nested_key(root: Path):
    make_env(root, "nosuccess", MANIFEST.replace("  success: success.py:check\n", ""))
    assert one(root).error == "env.yaml: missing key 'episode.success'"


def test_bad_types(root: Path):
    make_env(root, "a", MANIFEST.replace("action_dim: 6", "action_dim: six"))
    make_env(root, "b", MANIFEST.replace("  max_seconds: 30", "  max_seconds: soon"))
    a, b = scan_envs(root)
    assert a.error == "env.yaml: 'action_dim' must be a positive integer"
    assert b.error == "env.yaml: 'episode.max_seconds' must be a number"


def test_camera_list_accepted(root: Path):
    text = MANIFEST.replace(
        "  top: { resolution: [640, 480], fps: 30 }\n  wrist: { resolution: [640, 480], fps: 30 }\n",
        "  - top\n",
    )
    make_env(root, "list-cams", text)
    assert one(root).cameras == ["top"]


def test_missing_scene(root: Path):
    make_env(root, "noscene", files={"success.py": "def check(s): ..."})
    env = one(root)
    assert env.state == "invalid" and env.error == "env.yaml: scene.usd not found"
    # Parsed fields are still reported for invalid folders
    assert env.name == "Test scene" and env.cameras == ["top", "wrist"]


def test_missing_success_module(root: Path):
    make_env(root, "nocheck", files={"scene.usd": "#usda 1.0\n"})
    env = one(root)
    assert env.state == "invalid"
    assert env.error == "env.yaml: success.py not found (expected success.py:check)"


def test_skipped_entries(root: Path):
    make_env(root, "_template")
    make_env(root, ".hidden")
    (root / "notes.txt").write_text("not a folder")
    make_env(root, "b-env")
    make_env(root, "a-env")
    assert [e.id for e in scan_envs(root)] == ["a-env", "b-env"]


def test_hidden_files_and_pycache_not_listed(root: Path):
    d = make_env(root, "stack")
    (d / ".DS_Store").write_text("x")
    (d / "__pycache__").mkdir()
    (d / "__pycache__" / "success.cpython-312.pyc").write_text("x")
    assert [f.path for f in one(root).files] == ["env.yaml", "scene.usd", "success.py"]


def test_missing_root(root: Path):
    assert scan_envs(root / "nope") == []


def test_registered_at_from_first_seen(root: Path):
    make_env(root, "stack")
    env = scan_envs(root, {"stack": "2026-09-20T10:12:00+09:00"})[0]
    assert env.registered_at == "2026-09-20T10:12:00+09:00"


def test_updated_at_tracks_latest_file(root: Path):
    d = make_env(root, "stack")
    os.utime(d, (1_700_000_000, 1_700_000_000))
    for f in d.iterdir():
        os.utime(f, (1_700_000_000, 1_700_000_000))
    os.utime(d / "success.py", (1_800_000_000, 1_800_000_000))
    assert one(root).updated_at.startswith("2027-01-15")


def test_repo_examples(envs_dir: Path):
    envs = {e.id: e for e in scan_envs(envs_dir)}
    assert "_template" not in envs
    assert {"stack-two-blocks", "open-drawer", "clutter-stress", "pour-into-cup"} <= envs.keys()
    assert envs["pour-into-cup"].state == "invalid"
    assert all(e.state == "ready" for k, e in envs.items() if k != "pour-into-cup")
    assert envs["sort-by-color"].calibrated is False
    assert envs["top-only-demo"].cameras == ["top"]

import os
from pathlib import Path

import pytest

from app.services.simulation.scanner import scan_envs, scan_robots

SCRIPT = 'def build(scene):\n    scene.add("table")\n'


@pytest.fixture
def root(tmp_path: Path) -> Path:
    # Separate from the autouse envs_dir copy in tmp_path/envs
    d = tmp_path / "scan"
    d.mkdir()
    return d


def write(root: Path, rel: str, body: str = SCRIPT) -> Path:
    p = root / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(body)
    return p


def test_missing_root_is_empty(tmp_path: Path):
    assert scan_envs(tmp_path / "nope") == []


def test_top_level_scripts(root: Path):
    for name in ("b.py", "a.py", "stage.usda", "notes.txt", "_draft.py", ".hidden.py"):
        write(root, name)
    envs = scan_envs(root)
    assert [(e.id, e.script) for e in envs] == [("a", "a.py"), ("b", "b.py")]
    a = envs[0]
    assert a.name == "a" and a.path == str((root / "a.py").resolve())
    assert [f.path for f in a.files] == ["a.py"] and a.size_kb == 1


def test_folder_needs_env_py(root: Path):
    write(root, "kitchen/env.py")
    write(root, "kitchen/helpers.py")
    write(root, "kitchen/props/cup.usd", "x" * 3000)
    write(root, "kitchen/__pycache__/env.pyc")
    write(root, "solo/room.py")  # no env.py: not listed
    write(root, "docs/readme.txt")
    envs = {e.id: e for e in scan_envs(root)}
    assert list(envs) == ["kitchen"]
    k = envs["kitchen"]
    assert k.script == "env.py" and k.path == str((root / "kitchen").resolve())
    assert [f.path for f in k.files] == ["env.py", "helpers.py", "props/cup.usd"]
    assert k.size_kb == 4  # 3000 + 2 × 37 bytes, rounded up


def test_folder_wins_over_a_file_with_the_same_id(root: Path):
    write(root, "table.py")
    write(root, "table/env.py")
    [env] = scan_envs(root)
    assert env.path == str((root / "table").resolve())


def test_registered_and_updated_times(root: Path):
    p = write(root, "table.py")
    os.utime(p, (1_700_000_000, 1_700_000_000))
    [env] = scan_envs(root, {"table": "2026-01-01T00:00:00+09:00"})
    assert env.registered_at == "2026-01-01T00:00:00+09:00"
    assert env.updated_at.startswith("2023-11-15")


def test_thumbnails_and_no_rig_folders(root: Path):
    write(root, "arm.py")
    write(root, "arm.png", "img")
    write(root, "yard/env.py")
    write(root, "yard/thumbnail.jpg", "img")
    write(root, "bench/env.py")
    write(root, "so101-kit/table.py")  # folders need env.py: no rig groups
    envs = {e.id: e for e in scan_envs(root)}
    assert list(envs) == ["arm", "bench", "yard"]
    assert envs["arm"].thumbnail and envs["yard"].thumbnail and not envs["bench"].thumbnail


def test_robots(tmp_path: Path):
    root = tmp_path / "robots"
    write(root, "so101_follower.usd", "x")
    write(root, "koch/koch.usda", "x")
    write(root, "koch/meshes/link.usd", "x")
    write(root, "empty/readme.txt", "x")
    write(root, "_old.usd", "x")
    assert [r.id for r in scan_robots(root)] == ["koch", "so101_follower"]
    assert scan_robots(tmp_path / "nope") == []

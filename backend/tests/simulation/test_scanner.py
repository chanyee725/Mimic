import os
from pathlib import Path

import pytest

from app.services.simulation.scanner import scan_envs

STAGE = "#usda 1.0\n"


@pytest.fixture
def root(tmp_path: Path) -> Path:
    # Separate from the autouse envs_dir copy in tmp_path/envs
    d = tmp_path / "scan"
    d.mkdir()
    return d


def write(root: Path, rel: str, body: str = STAGE) -> Path:
    p = root / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(body)
    return p


def test_missing_root_is_empty(tmp_path: Path):
    assert scan_envs(tmp_path / "nope") == []


def test_top_level_stage_files(root: Path):
    for name in ("b.usda", "a.usd", "c.usdc", "d.USDZ", "notes.txt", "_draft.usd", ".hidden.usd"):
        write(root, name)
    envs = scan_envs(root)
    assert [(e.id, e.scene) for e in envs] == [
        ("a", "a.usd"),
        ("b", "b.usda"),
        ("c", "c.usdc"),
        ("d", "d.USDZ"),
    ]
    a = envs[0]
    assert a.name == "a" and a.path == str((root / "a.usd").resolve())
    assert [f.path for f in a.files] == ["a.usd"] and a.size_kb == 1


def test_folder_prefers_scene_then_the_only_stage(root: Path):
    write(root, "kitchen/scene.usda")
    write(root, "kitchen/props.usd")
    write(root, "kitchen/assets/cup.usd", "x" * 3000)
    write(root, "kitchen/__pycache__/x.pyc")
    write(root, "solo/room.usdc")
    write(root, "pair/a.usd")
    write(root, "pair/b.usd")  # two stages, no scene: not listed
    write(root, "docs/readme.txt")  # no stage: not listed
    envs = {e.id: e for e in scan_envs(root)}
    assert list(envs) == ["kitchen", "solo"]
    k = envs["kitchen"]
    assert k.scene == "scene.usda" and k.path == str((root / "kitchen").resolve())
    assert [f.path for f in k.files] == ["assets/cup.usd", "props.usd", "scene.usda"]
    assert k.size_kb == 3  # 3020 bytes, rounded up
    assert envs["solo"].scene == "room.usdc"


def test_folder_wins_over_a_file_with_the_same_id(root: Path):
    write(root, "table.usd")
    write(root, "table/scene.usd")
    [env] = scan_envs(root)
    assert env.path == str((root / "table").resolve())


def test_registered_and_updated_times(root: Path):
    p = write(root, "table.usda")
    os.utime(p, (1_700_000_000, 1_700_000_000))
    [env] = scan_envs(root, {"table": "2026-01-01T00:00:00+09:00"})
    assert env.registered_at == "2026-01-01T00:00:00+09:00"
    assert env.updated_at.startswith("2023-11-15")


def test_rig_folders_and_thumbnails(root: Path):
    write(root, "so101-kit/arm.usda")
    write(root, "so101-kit/arm.png", "img")
    write(root, "so101-kit/bench/scene.usd")
    write(root, "so101-kit/table.usda")  # found before the top-level folder below: wins
    write(root, "table/scene.usda")
    write(root, "yard/scene.usda")
    write(root, "yard/thumbnail.jpg", "img")
    write(root, "other-rig/scene.usda")  # not a rig: a folder env as before
    envs = {e.id: e for e in scan_envs(root, rig_ids={"so101-kit"})}
    assert list(envs) == ["arm", "bench", "other-rig", "table", "yard"]
    assert envs["arm"].rig_id == "so101-kit" and envs["arm"].thumbnail
    assert envs["bench"].rig_id == "so101-kit" and not envs["bench"].thumbnail
    assert envs["table"].rig_id == "so101-kit"
    assert envs["table"].path == str((root / "so101-kit" / "table.usda").resolve())
    assert envs["yard"].rig_id is None and envs["yard"].thumbnail
    assert envs["other-rig"].rig_id is None

from datetime import date, datetime

import pytest

from app.configs.config import REPO_ROOT
from app.utils import ids, paths, rng, time


def test_iso_accepts_seed_formats():
    assert time.iso("2026-10-02 14:05") == "2026-10-02T14:05:00+09:00"
    assert time.iso("2026-10-02") == "2026-10-02T00:00:00+09:00"
    assert time.iso("2026-10-02T01:02:03+00:00") == "2026-10-02T01:02:03+00:00"


def test_set_clock_overrides_now():
    fixed = datetime.fromisoformat("2026-10-02T10:00:00.250+09:00")
    time.set_clock(lambda: fixed)
    assert time.now_iso() == "2026-10-02T10:00:00+09:00"
    assert time.now_iso(ms=True) == "2026-10-02T10:00:00.250+09:00"
    time.set_clock(None)
    assert time.now() != fixed


def test_week_helpers():
    assert time.week_start(date(2026, 10, 3)) == date(2026, 9, 27)  # Saturday → Sunday
    assert time.week_start(date(2026, 9, 27)) == date(2026, 9, 27)
    assert len(time.days(date(2026, 9, 27), date(2026, 10, 3))) == 7


def test_paths(tmp_path):
    assert paths.resolve_user_path("sim/envs") == REPO_ROOT / "sim/envs"
    assert paths.display_path(REPO_ROOT / "sim/envs") == "sim/envs"
    assert paths.display_path(tmp_path) == str(tmp_path)
    for name in ("b", "a", "_template", ".git"):
        (tmp_path / name).mkdir()
    (tmp_path / "a" / "x.txt").write_text("x" * 1500)
    (tmp_path / "a" / ".hidden").write_text("")
    (tmp_path / "a" / "__pycache__").mkdir()
    (tmp_path / "a" / "__pycache__" / "c.pyc").write_text("")
    assert [p.name for p in paths.visible_dirs(tmp_path)] == ["a", "b"]
    assert paths.visible_dirs(tmp_path / "missing") == []
    files = list(paths.walk_files(tmp_path / "a"))
    assert [p.name for p in files] == ["x.txt"]
    assert paths.size_kb(files[0]) == 2
    assert paths.latest_mtime(tmp_path / "a") >= files[0].stat().st_mtime


def test_ids():
    assert ids.next_seq_id("job", ["job_001", "job_009", "sim_050", "x"]) == "job_010"
    assert ids.next_seq_id("job", []) == "job_001"
    assert ids.seq_num("sim_012") == 12
    assert ids.seq_num("abc") == 0
    assert ids.slugify("NVIDIA RTX 4090") == "nvidia-rtx-4090"
    assert ids.split_csv(" a, b,,c ") == ["a", "b", "c"]
    assert ids.split_csv(None) == []


@pytest.mark.parametrize("seed", [1, 42])
def test_rng_is_deterministic(seed):
    a, b = rng.mulberry32(seed), rng.mulberry32(seed)
    assert [a() for _ in range(5)] == [b() for _ in range(5)]
    assert 0 <= rng.unit_seed("rec_001") < 1
    assert rng.hash_seed("job_001") == rng.hash_seed("job_001")

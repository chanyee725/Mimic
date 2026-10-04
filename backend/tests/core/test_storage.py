import stat

import pytest

from app.core import storage


def test_write_read_roundtrip():
    storage.write("scratch/a.yaml", {"name": "블록", "n": [1, 2]})
    assert storage.read("scratch/a.yaml") == {"name": "블록", "n": [1, 2]}
    assert "블록" in storage.read_text("scratch/a.yaml")
    assert [p.name for p in storage.list_yaml("scratch")] == ["a.yaml"]
    storage.delete("scratch/a.yaml")
    assert storage.read("scratch/a.yaml") is None
    assert storage.list_yaml("missing") == []


def test_private_files_are_owner_only():
    storage.write("secrets.yaml", {"k": "v"}, private=True)
    mode = stat.S_IMODE(storage.path("secrets.yaml").stat().st_mode)
    assert mode == 0o600


def test_invalid_yaml_raises():
    storage.write_text("bad.yaml", "a: [1, 2")
    with pytest.raises(storage.StorageError):
        storage.read("bad.yaml")


def test_config_areas_live_in_the_config_folder():
    from app.configs.config import config
    from app.core import storage

    assert storage.path("rigs", "a.yaml") == config.config_dir / "rigs" / "a.yaml"
    assert storage.path("settings/runpod.yaml") == config.config_dir / "settings" / "runpod.yaml"
    assert storage.path("tasks/t.yaml") == config.data_dir / "tasks" / "t.yaml"


def test_legacy_config_areas_move_out_of_the_data_folder():
    import shutil

    from app.configs.config import config
    from app.core import storage
    from app.services import rigs

    # A station from before the split: rigs and calibration under data/
    shutil.move(config.config_dir / "rigs", config.data_dir / "rigs")
    (config.data_dir / "calibration" / "robots").mkdir(parents=True)
    (config.data_dir / "calibration" / "robots" / "x.json").write_text("{}")
    rigs.reset()
    assert (
        not (config.data_dir / "rigs").exists() and not (config.data_dir / "calibration").exists()
    )
    assert (config.config_dir / "calibration" / "robots" / "x.json").is_file()
    assert [r.id for r in rigs.list_rigs()] == ["so101-bimanual-kit", "so101-kit"]
    assert storage.path("rigs") == config.config_dir / "rigs"

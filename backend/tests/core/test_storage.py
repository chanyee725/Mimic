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

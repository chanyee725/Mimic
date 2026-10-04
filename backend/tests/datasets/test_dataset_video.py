"""Camera video in converted / merged datasets, checked against lerobot's own loader."""

import json

import av
import numpy as np
import pyarrow.parquet as pq
import pytest

from app.services import datasets as service
from app.services.datasets import lerobot as lr
from tests.conftest import add_tasks
from tests.support import write_recording

TASK = "stack-two-blocks"
CAMS = ["top", "wrist"]


@pytest.fixture(autouse=True)
def _tasks():
    add_tasks(TASK)


@pytest.fixture
def video_recs():
    """Accepted 2 s and 1 s episodes with both cameras at 30 fps."""
    return [write_recording(i, duration_s=d, cameras=CAMS) for i, d in ((1, 2.0), (2, 1.0))]


def convert(client, repo_id: str, exclude: list[str] | None = None) -> dict:
    body = {"taskId": TASK, "repoId": repo_id, "exclude": exclude or []}
    assert client.post("/convert", json=body).status_code == 202
    service.wait(repo_id)
    ds = client.get(f"/datasets/{repo_id}").json()
    assert ds["status"] == "ready", ds
    return ds


def meta(repo_id: str) -> tuple[dict, list[dict]]:
    root = service.folder(repo_id)
    info = json.loads((root / lr.INFO_PATH).read_text())
    return info, lr.read_episodes(root).to_pylist()


def lerobot_dataset(repo_id: str):
    ld = pytest.importorskip("lerobot.datasets.lerobot_dataset")
    return ld.LeRobotDataset(repo_id, root=service.folder(repo_id), video_backend="pyav")


def test_convert_writes_video_features(client, video_recs):
    ds = convert(client, "local/cams")
    keys = {f["key"]: f for f in ds["features"]}
    assert keys["observation.images.top"]["dtype"] == "video"
    assert keys["observation.images.top"]["shape"] == "[48, 64, 3]"

    info, eps = meta("local/cams")
    assert info["video_path"] == lr.VIDEO_PATH
    ft = info["features"]["observation.images.wrist"]
    assert ft["names"] == ["height", "width", "channels"]
    assert ft["info"]["video.codec"] == "h264" and ft["info"]["video.fps"] == 30
    # Episodes sit back to back in one file per camera
    assert [e["length"] for e in eps] == [60, 30]
    assert [e["videos/observation.images.top/from_timestamp"] for e in eps] == [0.0, 2.0]
    assert eps[1]["videos/observation.images.top/to_timestamp"] == pytest.approx(3.0)
    assert np.asarray(eps[0]["stats/observation.images.top/mean"]).shape == (3, 1, 1)
    stats = json.loads((service.folder("local/cams") / lr.STATS_PATH).read_text())
    mean = np.asarray(stats["observation.images.top"]["mean"])
    assert mean.shape == (3, 1, 1) and 0 < mean.min() <= mean.max() < 1

    video = service.folder("local/cams") / lr.VIDEO_PATH.format(
        video_key="observation.images.top", chunk_index=0, file_index=0
    )
    with av.open(str(video)) as c:
        assert c.streams.video[0].codec_context.name == "h264"
        assert sum(1 for _ in c.decode(video=0)) == 90
    # Video columns stay out of the data files
    data = pq.read_table(service.folder("local/cams") / "data" / "chunk-000" / "file-000.parquet")
    assert "observation.images.top" not in data.column_names


def test_lerobot_loads_the_converted_dataset(client, video_recs):
    convert(client, "local/cams")
    ds = lerobot_dataset("local/cams")
    assert len(ds) == 90 and ds.num_episodes == 2
    item = ds[0]
    assert tuple(item["observation.images.top"].shape) == (3, 48, 64)
    # A frame of the second episode decodes from its span of the shared file
    last = ds[89]
    assert int(last["episode_index"]) == 1
    assert tuple(last["observation.images.wrist"].shape) == (3, 48, 64)


def test_camera_missing_in_a_recording_is_skipped(client):
    write_recording(1, duration_s=1.0, cameras=["top", "wrist"])
    write_recording(2, duration_s=1.0, cameras=["top"])
    convert(client, "local/partial")
    info, _ = meta("local/partial")
    assert "observation.images.top" in info["features"]
    assert "observation.images.wrist" not in info["features"]
    sidecar = service.datasets.read_sidecar(service.folder("local/partial"))
    assert sidecar["skipped_cameras"] == ["wrist"]


def test_merge_reencodes_videos(client, video_recs):
    convert(client, "local/a", exclude=[video_recs[1].id])
    convert(client, "local/b", exclude=[video_recs[0].id])
    r = client.post(
        "/datasets/merge", json={"sources": ["local/a", "local/b"], "repoId": "local/ab"}
    )
    assert r.status_code == 202, r.text
    service.wait("local/ab")
    assert client.get("/datasets/local/ab").json()["status"] == "ready"
    info, eps = meta("local/ab")
    assert info["total_frames"] == 90
    assert [e["videos/observation.images.top/from_timestamp"] for e in eps] == [0.0, 2.0]
    ds = lerobot_dataset("local/ab")
    assert len(ds) == 90
    assert tuple(ds[89]["observation.images.top"].shape) == (3, 48, 64)


def test_merge_rejects_different_cameras(client, video_recs):
    convert(client, "local/cams")
    write_recording(5, duration_s=1.0)  # no cameras
    convert(client, "local/plain", exclude=[r.id for r in video_recs])
    p = client.get("/datasets/merge/preview", params={"sources": "local/cams,local/plain"}).json()
    assert any("observation.images.top" in x for x in p["problems"])


def test_thumbnail(client, video_recs):
    convert(client, "local/cams")
    r = client.get("/datasets/local/cams/thumbnail")
    assert r.status_code == 200 and r.headers["content-type"] == "image/jpeg"
    assert r.content[:2] == b"\xff\xd8"
    cached = service.folder("local/cams") / "meta" / "thumbnail.jpg"
    assert cached.is_file()
    assert client.get("/datasets/local/cams/thumbnail").content == r.content
    assert client.get("/datasets/local/nope/thumbnail").status_code == 404

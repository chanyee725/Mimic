"""Recordings on disk: Capture writes MCAP + sidecar under the raw folder; they survive restarts."""

import json
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
import yaml
from mcap.reader import make_reader

from app.configs.config import REPO_ROOT, config
from app.services import capture, recordings, tasks
from app.services.recordings import disk
from app.utils import time

T0 = datetime(2026, 10, 3, 10, 0, 0, tzinfo=ZoneInfo("Asia/Seoul"))
START = {"taskId": "stack-two-blocks", "operator": "OP-01"}
MAGIC = b"\x89MCAP0\r\n"
REC_ID = "stack-two-blocks-47"


class FakeClock:
    def __init__(self) -> None:
        self.t = T0

    def __call__(self) -> datetime:
        return self.t

    def advance(self, s: float) -> None:
        self.t += timedelta(seconds=s)


@pytest.fixture(autouse=True)
def clock():
    c = FakeClock()
    time.set_clock(c)
    yield c
    time.set_clock(None)
    capture.reset()


@pytest.fixture
def raw():
    return disk.raw_dir()


def save(client, clock, seconds: float = 10, outcome: str = "success") -> dict:
    assert client.post("/capture/start", json=START).status_code == 200
    clock.advance(3 + seconds)  # countdown 3 s
    r = client.post("/capture/save", json={"outcome": outcome})
    assert r.status_code == 201
    return r.json()


def restart() -> None:
    """In-memory state back to seeds, as after a backend restart."""
    tasks.reset()
    capture.reset()
    recordings.reset()


def test_raw_folder_is_test_temp(raw):
    assert raw == config.data_dir / "recordings"
    assert not raw.is_relative_to(REPO_ROOT)


def test_save_writes_mcap_and_sidecar(client, clock, raw):
    assert client.post("/capture/start", json=START).status_code == 200
    clock.advance(3 + 4)
    client.post("/capture/subtask", json={"index": 1})
    clock.advance(6)
    rec = client.post("/capture/save", json={"outcome": "partial"}).json()
    assert rec["file"] == "stack-two-blocks/ep_0047.mcap"

    mcap = raw / "stack-two-blocks" / "ep_0047.mcap"
    assert mcap.read_bytes().startswith(MAGIC)
    assert rec["sizeMB"] == round(mcap.stat().st_size / 1_000_000, 2)
    with mcap.open("rb") as f:
        reader = make_reader(f)
        summary = reader.get_summary()
        topics = {c.id: c.topic for c in summary.channels.values()}
        counts = {topics[cid]: n for cid, n in summary.statistics.channel_message_counts.items()}
        assert counts == {"/action": 600, "/observation/state": 600, "/subtask": 2}  # 10 s × 60 Hz
        meta = {m.name: m.metadata for m in reader.iter_metadata()}
    assert meta["episode"] == {
        "recording_id": REC_ID,
        "task_id": "stack-two-blocks",
        "rig_id": "so101-kit",
        "episode": "47",
        "operator": "OP-01",
        "outcome": "partial",
    }
    assert [t["name"] for t in rec["topics"]] == list(counts)

    side = yaml.safe_load((raw / "stack-two-blocks" / "ep_0047.yaml").read_text())
    assert side["id"] == REC_ID and side["task_id"] == "stack-two-blocks"
    assert side["size_mb"] == rec["sizeMB"] and side["review"] == "pending"
    assert side["topics"][0]["schema"] == "vla.robot.JointCommand"
    assert side["subtasks"][1] == {"name": "grasp", "start_s": 4.0, "end_s": 10.0}


def test_survives_restart(client, clock):
    rec = save(client, clock)
    restart()
    assert recordings.is_on_disk(REC_ID)
    assert client.get(f"/recordings/{REC_ID}").json() == rec
    assert client.get("/recordings").json()["total"] == 22  # 21 seeds + 1


def test_episode_numbers_after_restart(client, clock):
    save(client, clock)
    save(client, clock)
    restart()
    assert save(client, clock)["episode"] == 49


def test_review_patch_persists(client, clock, raw):
    save(client, clock)
    assert client.patch(f"/recordings/{REC_ID}", json={"review": "accepted"}).status_code == 200
    side = yaml.safe_load((raw / "stack-two-blocks" / "ep_0047.yaml").read_text())
    assert side["review"] == "accepted"
    restart()
    assert client.get(f"/recordings/{REC_ID}").json()["review"] == "accepted"


def test_delete_removes_files(client, clock, raw):
    save(client, clock)
    folder = raw / "stack-two-blocks"
    assert client.delete(f"/recordings/{REC_ID}").status_code == 204
    assert list(folder.iterdir()) == []
    restart()
    assert client.get(f"/recordings/{REC_ID}").status_code == 404


def test_file_download(client, clock, raw):
    save(client, clock)
    r = client.get(f"/recordings/{REC_ID}/file")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/octet-stream"
    assert r.content.startswith(MAGIC)
    assert r.content == (raw / "stack-two-blocks" / "ep_0047.mcap").read_bytes()
    (raw / "stack-two-blocks" / "ep_0047.mcap").unlink()
    assert client.get(f"/recordings/{REC_ID}/file").status_code == 404


def test_samples_come_from_the_file(client, clock, raw, monkeypatch):
    save(client, clock)
    params = {"fromS": 0, "toS": 2, "hz": 10}
    a = client.get(f"/recordings/{REC_ID}/samples", params=params).json()
    assert a["joints"][0] == "shoulder_pan" and len(a["t"]) == 21
    assert len(a["series"]["action"]) == 6 and len(a["series"]["state"][0]) == 21
    # Recorded at 60 Hz: 0.5 s is an exact sample; state trails action by STATE_LAG_S
    with (raw / "stack-two-blocks" / "ep_0047.mcap").open("rb") as f:
        msgs = list(make_reader(f).iter_messages(topics=["/action"]))
    assert a["series"]["action"][0][5] == json.loads(msgs[30][2].data)["position"][0]
    assert a["series"]["state"] != a["series"]["action"]
    # Proof that the file is read: a broken file fails instead of falling back to the mock
    (raw / "stack-two-blocks" / "ep_0047.mcap").write_bytes(MAGIC + b"\x00" * 16)
    r = client.get(f"/recordings/{REC_ID}/samples", params=params)
    assert r.status_code == 422


def test_import_persists(client, raw):
    with open(_sample_mcap(raw), "rb") as f:
        data = f.read()
    r = client.post("/recordings/import", files={"file": ("Bag.mcap", data)})
    assert r.status_code == 201
    rec = r.json()
    assert rec["file"] == "imports/Bag.mcap" and rec["id"] == "ext-bag"
    assert (raw / "imports" / "Bag.mcap").read_bytes() == data
    assert (raw / "imports" / "Bag.yaml").is_file()
    again = client.post("/recordings/import", files={"file": ("Bag.mcap", data)}).json()
    assert again["id"] == "ext-bag-2" and again["file"] == "imports/Bag-2.mcap"
    restart()
    assert client.get("/recordings/ext-bag").json() == rec
    assert client.get("/recordings/ext-bag/file").content == data
    assert client.get("/recordings", params={"source": "external"}).json()["total"] == 4


def _sample_mcap(raw):
    """Any valid MCAP: an episode written by Capture, moved out of the raw folder."""
    from app.services.recordings import mcap_io as recordings_mcap

    ep = recordings_mcap.Episode(
        start_ns=0, duration_s=1, hz=10, joints=["a"], seed=0.0, metadata={"x": "y"}
    )
    p = config.data_dir / "sample.mcap"
    p.write_bytes(recordings_mcap.encode(ep))
    return p


def test_broken_sidecar_skipped(client, clock, raw, caplog):
    save(client, clock)
    folder = raw / "stack-two-blocks"
    (folder / "ep_0099.yaml").write_text("id: [unclosed\n")
    (folder / "ep_0098.yaml").write_text("- a list\n")
    (folder / "ep_0097.yaml").write_text("id: x\n")  # missing fields
    restart()
    assert recordings.is_on_disk(REC_ID)
    assert client.get("/recordings").json()["total"] == 22
    assert sum("is invalid" in m for m in caplog.messages) == 3


def test_disk_overrides_seed(client, raw):
    seed = client.get("/recordings/stack-two-blocks-30").json()
    rec = recordings.get_recording("stack-two-blocks-30").model_copy(
        update={"review": "rejected", "file": "stack-two-blocks/ep_0030.mcap"}
    )
    disk.write_sidecar(raw, rec)
    restart()
    assert client.get("/recordings/stack-two-blocks-30").json()["review"] == "rejected"
    assert seed["review"] != "rejected"
    assert client.get("/recordings").json()["total"] == 21


def test_seed_recordings_have_no_file(client):
    assert not recordings.is_on_disk("stack-two-blocks-30")
    assert client.get("/recordings/stack-two-blocks-30/file").status_code == 501

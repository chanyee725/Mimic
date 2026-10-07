"""Datasets: real LeRobot v3.0 folders written by convert, read back with pyarrow."""

import json
import shutil
import time

import pyarrow as pa
import pyarrow.parquet as pq
import pytest
import yaml

from app.configs.config import config
from app.core.events import bus
from app.services import datasets as service
from app.services.recordings import disk
from tests.conftest import add_tasks
from tests.support import write_recording

TASK = "stack-two-blocks"
FEATURES = [
    "action",
    "observation.state",
    "timestamp",
    "frame_index",
    "episode_index",
    "index",
    "task_index",
    "subtask_index",
]


@pytest.fixture(autouse=True)
def _tasks():
    add_tasks("stack-two-blocks", "open-drawer")


@pytest.fixture
def events():
    q = bus.subscribe()
    out: list[dict] = []

    def drain() -> list[dict]:
        while not q.empty():
            out.append(q.get_nowait())
        return out

    yield drain
    bus.unsubscribe(q)


@pytest.fixture
def recs():
    """Accepted episodes of 2 s, 3 s, 4 s and one pending episode."""
    out = [write_recording(i, duration_s=1 + i) for i in (1, 2, 3)]
    out.append(write_recording(4, review="pending"))
    return out


def convert(client, repo_id: str, task_id: str = TASK, exclude: list[str] | None = None) -> dict:
    body = {"taskId": task_id, "repoId": repo_id, "exclude": exclude or []}
    r = client.post("/convert", json=body)
    assert r.status_code == 202, r.text
    assert r.json()["status"] == "converting" and r.json()["progress"] == 0
    service.wait(repo_id)
    return client.get(f"/datasets/{repo_id}").json()


def info(repo_id: str) -> dict:
    return json.loads((service.folder(repo_id) / "meta" / "info.json").read_text())


def frames(repo_id: str):
    return pq.read_table(service.folder(repo_id) / "data" / "chunk-000" / "file-000.parquet")


def test_starts_empty(client):
    assert client.get("/datasets").json() == []


def test_preview(client, recs):
    p = client.get("/convert/preview", params={"taskId": TASK}).json()
    assert p["fps"] == 30 and p["actionHz"] == 60
    assert [f["key"] for f in p["features"]] == FEATURES
    assert p["features"][0] == {
        "key": "action",
        "dtype": "float32",
        "shape": "[6]",
        "note": "60 Hz → 30 Hz",
    }
    assert not any(f["dtype"] == "video" for f in p["features"])
    assert p["episodes"] == 3 and p["frames"] == (2 + 3 + 4) * 30 and p["lengthS"] == 9
    assert p["recordedFrom"] <= p["recordedTo"]


def test_preview_exclude_and_empty(client, recs):
    p = client.get(
        "/convert/preview", params={"taskId": TASK, "exclude": f"{TASK}-1,{TASK}-2"}
    ).json()
    assert p["episodes"] == 1 and p["frames"] == 120
    empty = client.get("/convert/preview", params={"taskId": "open-drawer"}).json()
    assert empty["episodes"] == 0 and empty["recordedFrom"] is None


def test_preview_errors(client):
    assert client.get("/convert/preview", params={"taskId": "nope"}).status_code == 404
    assert client.get("/convert/preview").status_code == 422


def test_convert_writes_lerobot_v3(client, recs, events):
    ds = convert(client, "local/stack")
    assert ds["status"] == "ready" and ds["progress"] is None and ds["error"] is None
    assert ds["episodeCount"] == 3 and ds["format"] == "LeRobot v3.0" and ds["sources"] is None
    assert ds["taskId"] == TASK and ds["rigId"] == "so101-kit" and ds["sizeGB"] > 0
    root = config.datasets_dir / "local" / "stack"
    assert service.folder("local/stack") == root

    i = info("local/stack")
    assert i["codebase_version"] == "v3.0" and i["fps"] == 30
    assert i["total_episodes"] == 3 and i["total_frames"] == 270 and i["total_tasks"] == 1
    assert i["splits"] == {"train": "0:3"} and i["chunks_size"] == 1000
    assert i["data_path"] == "data/chunk-{chunk_index:03d}/file-{file_index:03d}.parquet"
    assert i["video_path"] is None and i["robot_type"] == "so101-kit"
    assert list(i["features"]) == FEATURES
    assert i["features"]["action"]["shape"] == [6]
    assert i["features"]["action"]["names"][0] == "shoulder_pan.pos"

    t = frames("local/stack")
    assert t.column_names == FEATURES and t.num_rows == 270
    action_type = t.schema.field("action").type
    assert pa.types.is_fixed_size_list(action_type) and action_type.list_size == 6
    assert action_type.value_type == pa.float32()
    assert t.column("index").to_pylist() == list(range(270))
    eps = t.column("episode_index").to_pylist()
    assert [eps.count(e) for e in (0, 1, 2)] == [60, 90, 120]
    assert t.column("frame_index").to_pylist()[60:63] == [0, 1, 2]
    assert t.column("timestamp").to_pylist()[61] == pytest.approx(1 / 30)
    assert set(t.column("task_index").to_pylist()) == {0}
    # Spans reach (first half) and grasp (second half) → task subtask order
    assert t.column("subtask_index").to_pylist()[:60] == [0] * 30 + [1] * 30

    tasks = pq.read_table(root / "meta" / "tasks.parquet")
    assert tasks.column("task").to_pylist() == ["stack the blue block on top of the red block"]
    assert tasks.column("task_index").to_pylist() == [0]
    assert b"pandas" in tasks.schema.metadata
    subtasks = pq.read_table(root / "meta" / "subtasks.parquet").column("subtask").to_pylist()
    assert subtasks == ["reach", "grasp", "lift", "place"]

    ep = pq.read_table(root / "meta" / "episodes" / "chunk-000" / "file-000.parquet")
    assert ep.column("length").to_pylist() == [60, 90, 120]
    assert ep.column("dataset_from_index").to_pylist() == [0, 60, 150]
    assert ep.column("dataset_to_index").to_pylist() == [60, 150, 270]
    assert ep.column("data/file_index").to_pylist() == [0, 0, 0]
    assert ep.column("stats/action/count").to_pylist()[0] == [60]
    stats = json.loads((root / "meta" / "stats.json").read_text())
    assert stats["action"]["count"] == [270] and len(stats["action"]["mean"]) == 6
    assert set(stats["action"]) >= {"min", "max", "mean", "std", "q01", "q99"}

    # Action is downsampled from the 60 Hz file: frame k = MCAP sample 2k
    samples = client.get(f"/recordings/{TASK}-1/samples", params={"hz": 30, "toS": 1}).json()
    first = t.column("action").to_pylist()[:31]
    assert [round(row[0], 3) for row in first] == samples["series"]["action"][0]

    msgs = [m for m in events() if m["type"] == "dataset.updated"]
    assert [m["data"]["progress"] for m in msgs[:-1]] == [0, 33, 66, 99]
    assert msgs[-1]["data"]["status"] == "ready"


def test_convert_exclude(client, recs):
    ds = convert(client, "local/stack", exclude=[f"{TASK}-1"])
    assert ds["episodeCount"] == 2 and info("local/stack")["total_frames"] == 210


def test_convert_errors(client, recs):
    convert(client, "local/stack")
    body = {"taskId": TASK, "repoId": "local/stack"}
    assert client.post("/convert", json=body).status_code == 409
    assert client.post("/convert", json={**body, "taskId": "nope"}).status_code == 404
    r = client.post("/convert", json={**body, "taskId": "open-drawer", "repoId": "local/x"})
    assert r.status_code == 422
    for bad in ("nosplash", "local/..", ".hidden/x", "a/b/c"):
        assert client.post("/convert", json={**body, "repoId": bad}).status_code == 422, bad


def test_convert_failure_reports_error(client, recs):
    (disk.raw_dir() / TASK / "ep_0002.mcap").write_bytes(b"\x89MCAP0\r\n" + b"\0" * 16)
    ds = convert(client, "local/broken")
    assert ds["status"] == "failed" and "ep_0002.mcap" in ds["error"]
    assert not (config.datasets_dir / "local" / "broken").exists()
    assert list((config.datasets_dir / "local").iterdir()) == []


def test_index_rebuilt_from_disk(client, recs):
    ds = convert(client, "local/stack")
    service.reset()
    assert client.get("/datasets").json() == [ds]
    # Broken or foreign folders are skipped
    (config.datasets_dir / "local" / "junk" / "meta").mkdir(parents=True)
    (config.datasets_dir / "local" / "junk" / "meta" / "info.json").write_text("{}")
    service.reset()
    assert [d["repoId"] for d in client.get("/datasets").json()] == ["local/stack"]


def test_list_filters(client, recs):
    convert(client, "local/stack")
    write_recording(1, task_id="open-drawer")
    convert(client, "lab/drawer", task_id="open-drawer")
    assert {d["repoId"] for d in client.get("/datasets").json()} == {"lab/drawer", "local/stack"}
    assert [d["repoId"] for d in client.get("/datasets", params={"q": "DRAWER"}).json()] == [
        "lab/drawer"
    ]
    assert client.get("/datasets", params={"kind": "mcap"}).json() == []


def test_get_and_episodes_paging(client, recs):
    convert(client, "local/stack")
    assert client.get("/datasets/local%2Fstack").status_code == 200
    assert client.get("/datasets/local/nope").status_code == 404
    page = client.get("/datasets/local/stack/episodes", params={"limit": 2}).json()
    assert page["total"] == 3 and page["nextCursor"] == "2"
    assert page["items"][0] == {
        "index": 0,
        "source": f"{TASK}/ep_0001.mcap",
        "lengthS": 2.0,
        "frames": 60,
    }
    rest = client.get("/datasets/local/stack/episodes", params={"cursor": "2"}).json()
    assert rest["items"][0]["frames"] == 120
    assert client.get("/datasets/local/nope/episodes").status_code == 404


def test_thumbnail_needs_video(client, recs):
    convert(client, "local/stack")
    r = client.get("/datasets/local/stack/thumbnail")
    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"


def test_push(client, recs, monkeypatch, events):
    from app.services.datasets import hub

    convert(client, "local/stack")
    r = client.post("/datasets/local/stack/push", json={"private": False})
    assert r.status_code == 424 and r.json()["error"]["details"] == {"secret": "hf_token"}
    uploaded = []
    monkeypatch.setattr(hub, "_token", lambda: "hf_test")
    monkeypatch.setattr(hub, "upload_folder", lambda *a: uploaded.append(a))
    r = client.post("/datasets/local/stack/push", json={"private": False})
    assert r.status_code == 202 and r.json()["hub"]["pushing"] is True
    for _ in range(100):
        if not service.require("local/stack").hub.pushing:
            break
        time.sleep(0.02)
    folder, repo, private, token = uploaded[0]
    assert (repo, private, token) == ("vla-lab/local-stack", False, "hf_test")
    assert folder == service.folder("local/stack")
    hub_state = client.get("/datasets/local/stack").json()["hub"]
    assert hub_state == {
        "pushed": True,
        "private": False,
        "pulled": False,
        "repo": "vla-lab/local-stack",
        "pushing": False,
        "error": None,
    }
    side = yaml.safe_load((service.folder("local/stack") / "station.yaml").read_text())
    assert side["hub"] == {
        "pushed": True,
        "private": False,
        "pulled": False,
        "repo": "vla-lab/local-stack",
    }
    service.reset()
    assert client.get("/datasets/local/stack").json()["hub"]["repo"] == "vla-lab/local-stack"
    # Already pushed: upload() skips it
    assert service.upload("local/stack") == "vla-lab/local-stack" and len(uploaded) == 1


def test_push_failure_is_kept_on_the_dataset(client, recs, monkeypatch):
    from app.services.datasets import hub

    convert(client, "local/stack")
    monkeypatch.setattr(hub, "_token", lambda: "hf_test")

    def fail(*a):
        raise RuntimeError("quota exceeded")

    monkeypatch.setattr(hub, "upload_folder", fail)
    with pytest.raises(Exception, match="quota exceeded"):
        service.upload("local/stack")
    h = service.require("local/stack").hub
    assert h.pushed is False and h.pushing is False and h.error == "quota exceeded"


def test_delete(client, recs, events):
    convert(client, "local/stack")
    assert client.delete("/datasets/local/stack").status_code == 204
    assert not service.folder("local/stack").exists()
    assert client.get("/datasets/local/stack").status_code == 404
    assert client.delete("/datasets/local/stack").status_code == 404
    assert events()[-1] == {
        "type": "dataset.deleted",
        "at": events()[-1]["at"],
        "data": {"repoId": "local/stack"},
    }


# --- merge ---


@pytest.fixture
def two(client, recs):
    """local/a (stack episodes 1–2) and local/b (open-drawer episodes 1–3, 1 s each)."""
    convert(client, "local/a", exclude=[f"{TASK}-3"])
    for i in (1, 2, 3):
        write_recording(i, task_id="open-drawer", duration_s=1)
    convert(client, "local/b", task_id="open-drawer")


def test_merge_preview(client, two):
    p = client.get("/datasets/merge/preview", params={"sources": "local/a,local/b"}).json()
    assert p["problems"] == []
    assert p["fps"] == 30 and p["episodes"] == 5 and p["frames"] == 150 + 90
    assert p["sources"][0] == {
        "repoId": "local/a",
        "episodes": 2,
        "frames": 150,
        "fps": 30,
        "rigId": "so101-kit",
        "taskId": TASK,
    }
    assert [f["key"] for f in p["features"]] == FEATURES and p["sizeGB"] > 0


def test_merge_writes_reindexed_dataset(client, two, events):
    r = client.post("/datasets/merge", json={"sources": ["local/a", "local/b"], "repoId": "m/ab"})
    assert r.status_code == 202, r.text
    assert r.json()["status"] == "converting" and r.json()["sources"] == ["local/a", "local/b"]
    service.wait("m/ab")
    ds = client.get("/datasets/m/ab").json()
    assert ds["status"] == "ready" and ds["episodeCount"] == 5
    assert ds["taskId"] == "mixed" and ds["sources"] == ["local/a", "local/b"]

    i = info("m/ab")
    assert i["total_episodes"] == 5 and i["total_frames"] == 240 and i["total_tasks"] == 2
    assert i["splits"] == {"train": "0:5"} and list(i["features"]) == FEATURES
    t = frames("m/ab")
    assert t.column("index").to_pylist() == list(range(240))
    eps = t.column("episode_index").to_pylist()
    assert [eps.count(e) for e in range(5)] == [60, 90, 30, 30, 30]
    assert t.column("task_index").to_pylist()[149:151] == [0, 1]
    tasks = pq.read_table(service.folder("m/ab") / "meta" / "tasks.parquet")
    assert tasks.column("task").to_pylist() == [
        "stack the blue block on top of the red block",
        "open the top drawer",
    ]
    # Subtask tables are unioned: open-drawer's "reach"/"grasp" keep the merged indices
    subs = pq.read_table(service.folder("m/ab") / "meta" / "subtasks.parquet")
    names = subs.column("subtask").to_pylist()
    assert names == ["reach", "grasp", "lift", "place", "pull"]
    assert set(t.column("subtask_index").to_pylist()[150:]) == {0, 1}
    # Source data is copied unchanged
    a = frames("local/a")
    assert t.column("action").to_pylist()[:150] == a.column("action").to_pylist()
    ep = pq.read_table(
        service.folder("m/ab") / "meta" / "episodes" / "chunk-000" / "file-000.parquet"
    )
    assert ep.column("dataset_from_index").to_pylist() == [0, 60, 150, 180, 210]
    assert ep.column("tasks").to_pylist()[2] == ["open the top drawer"]

    page = client.get("/datasets/m/ab/episodes").json()
    assert [e["source"] for e in page["items"]] == [
        f"{TASK}/ep_0001.mcap",
        f"{TASK}/ep_0002.mcap",
        "open-drawer/ep_0001.mcap",
        "open-drawer/ep_0002.mcap",
        "open-drawer/ep_0003.mcap",
    ]
    progress = [m["data"]["progress"] for m in events() if m["data"].get("repoId") == "m/ab"]
    assert progress[:2] == [0, 20] and progress[-1] is None

    # Survives a restart, with its sources
    service.reset()
    assert client.get("/datasets/m/ab").json() == ds


def test_worlds_follow_the_recordings_and_merge(client, recs):
    convert(client, "local/a", exclude=[f"{TASK}-3"])
    for i in (1, 2, 3):
        write_recording(i, task_id="open-drawer", duration_s=1, sim_env="open-drawer")
    convert(client, "local/b", task_id="open-drawer")
    assert client.get("/datasets/local/a").json()["worlds"] == ["real"]
    assert client.get("/datasets/local/b").json()["worlds"] == ["sim"]
    client.post("/datasets/merge", json={"sources": ["local/b", "local/a"], "repoId": "m/ab"})
    service.wait("m/ab")
    assert client.get("/datasets/m/ab").json()["worlds"] == ["real", "sim"]
    service.reset()  # kept in the sidecar
    assert client.get("/datasets/m/ab").json()["worlds"] == ["real", "sim"]


def test_merge_same_task_keeps_task_id(client, recs):
    convert(client, "local/a", exclude=[f"{TASK}-3"])
    convert(client, "local/b", exclude=[f"{TASK}-1", f"{TASK}-2"])
    r = client.post("/datasets/merge", json={"sources": ["local/a", "local/b"], "repoId": "m/x"})
    assert r.json()["taskId"] == TASK
    assert service.wait("m/x").task_id == TASK
    assert info("m/x")["total_tasks"] == 1


def test_merge_problems(client, two):
    def problems(sources: str) -> list[str]:
        return client.get("/datasets/merge/preview", params={"sources": sources}).json()["problems"]

    assert problems("local/a") == ["Pick at least two datasets to merge"]
    assert "Dataset 'local/nope' does not exist" in problems("local/a,local/nope")
    assert "Dataset 'local/a' is listed more than once" in problems("local/a,local/a,local/b")

    # Different fps on disk
    p = service.folder("local/b") / "meta" / "info.json"
    meta = json.loads(p.read_text())
    p.write_text(json.dumps({**meta, "fps": 15}))
    service.reset()
    assert problems("local/a,local/b") == ["Frame rates differ: local/a 30 fps, local/b 15 fps"]
    p.write_text(json.dumps(meta))

    # Different robot
    side = service.folder("local/b") / "station.yaml"
    side.write_text(side.read_text().replace("rig_id: so101-kit", "rig_id: so101-bimanual-kit"))
    service.reset()
    assert problems("local/a,local/b") == [
        "Robots differ: local/a so101-kit, local/b so101-bimanual-kit"
    ]


def test_merge_feature_mismatch(client, recs):
    convert(client, "local/a")
    five = ["j1", "j2", "j3", "j4", "j5"]
    write_recording(1, task_id="open-drawer", joints=five)
    convert(client, "local/b", task_id="open-drawer")
    out = client.get("/datasets/merge/preview", params={"sources": "local/a,local/b"}).json()
    assert out["problems"] == [
        "Feature 'action' differs: local/a float32 [6], local/b float32 [5]",
        "Feature 'observation.state' differs: local/a float32 [6], local/b float32 [5]",
    ]
    r = client.post("/datasets/merge", json={"sources": ["local/a", "local/b"], "repoId": "m/x"})
    assert r.status_code == 422
    assert r.json()["error"]["details"]["problems"] == out["problems"]
    assert client.get("/datasets/m/x").status_code == 404


def test_merge_errors(client, two):
    body = {"sources": ["local/a", "local/b"], "repoId": "local/a"}
    assert client.post("/datasets/merge", json=body).status_code == 409
    assert client.post("/datasets/merge", json={**body, "repoId": "bad"}).status_code == 422
    r = client.post("/datasets/merge", json={"sources": ["local/a"], "repoId": "m/x"})
    assert r.status_code == 422
    assert r.json()["error"]["details"]["problems"] == ["Pick at least two datasets to merge"]


def test_merge_source_deleted_meanwhile(client, two):
    shutil.rmtree(service.folder("local/b") / "data")
    r = client.post("/datasets/merge", json={"sources": ["local/a", "local/b"], "repoId": "m/x"})
    assert r.status_code == 202
    ds = service.wait("m/x")
    assert ds.status == "failed" and ds.error == "local/b has 0 of 3 episodes in its data files"
    assert not service.folder("m/x").exists()


# --- pull from the Hub ---


@pytest.fixture
def fake_hub(monkeypatch, tmp_path):
    """Serves folders under tmp_path/hub/<ns>/<name> as Hub dataset repos."""
    import httpx
    from huggingface_hub.errors import RepositoryNotFoundError

    from app.services.datasets import hub

    root = tmp_path / "hub"

    def repo_files(repo_id, token):
        src = root / repo_id
        if not src.is_dir():
            raise RepositoryNotFoundError(
                f"{repo_id} not found",
                response=httpx.Response(404, request=httpx.Request("GET", "https://hf.co")),
            )
        files = [p for p in sorted(src.rglob("*")) if p.is_file()]
        return [(str(p.relative_to(src)), p.stat().st_size) for p in files], True

    def download(repo_id, filename, local_dir, token):
        out = local_dir / filename
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(root / repo_id / filename, out)

    monkeypatch.setattr(hub, "repo_files", repo_files)
    monkeypatch.setattr(hub, "download", download)
    return root


def upload(client, fake_hub, local: str, remote: str):
    """Converts `local` and moves it onto the fake Hub as `remote`."""
    convert(client, local)
    dest = fake_hub / remote
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(service.folder(local), dest)
    client.delete(f"/datasets/{local}")


def test_pull(client, recs, fake_hub, events):
    upload(client, fake_hub, "local/stack", "op-01/stack")
    r = client.post("/datasets/pull", json={"repoId": "op-01/stack"})
    assert r.status_code == 202, r.text
    body = r.json()
    assert body["status"] == "converting" and body["progress"] == 0
    assert body["hub"]["pulled"] is True and body["hub"]["repo"] == "op-01/stack"
    assert body["episodeCount"] == 3 and body["fps"] == 30
    ds = service.wait("op-01/stack")
    assert ds.status == "ready" and ds.task_id == TASK  # from the uploaded station.yaml
    assert info("op-01/stack")["total_episodes"] == 3
    assert not (service.folder("op-01/stack") / ".cache").exists()
    assert client.get("/datasets/op-01/stack/episodes").json()["items"][0]["frames"] > 0
    assert any(e["type"] == "dataset.updated" and e["data"]["status"] == "ready" for e in events())
    service.reset()
    assert client.get("/datasets/op-01/stack").json()["hub"]["pulled"] is True
    r = client.post("/datasets/pull", json={"repoId": "op-01/stack"})
    assert r.status_code == 409


def test_pull_without_station_yaml(client, recs, fake_hub):
    upload(client, fake_hub, "local/stack", "op-01/plain")
    (fake_hub / "op-01/plain/station.yaml").unlink()
    client.post("/datasets/pull", json={"repoId": "op-01/plain"})
    ds = service.wait("op-01/plain")
    assert ds.status == "ready" and ds.task_id == "unknown" and ds.rig_id == "so101-kit"


def test_pull_errors(client, recs, fake_hub):
    r = client.post("/datasets/pull", json={"repoId": "nope"})
    assert r.status_code == 422
    r = client.post("/datasets/pull", json={"repoId": "op-01/missing"})
    assert r.status_code == 404 and "not found on the Hub" in r.json()["error"]["message"]
    (fake_hub / "op-01/empty").mkdir(parents=True)
    (fake_hub / "op-01/empty/README.md").write_text("hi")
    r = client.post("/datasets/pull", json={"repoId": "op-01/empty"})
    assert r.status_code == 422 and "meta/info.json" in r.json()["error"]["message"]
    upload(client, fake_hub, "local/stack", "op-01/old")
    path = fake_hub / "op-01/old/meta/info.json"
    path.write_text(json.dumps({**json.loads(path.read_text()), "codebase_version": "v2.1"}))
    r = client.post("/datasets/pull", json={"repoId": "op-01/old"})
    assert r.status_code == 422 and "v2.1" in r.json()["error"]["message"]
    assert client.get("/datasets").json() == []


def test_push_namespace_must_be_writable(client, recs, monkeypatch):
    from app.services import settings
    from app.services.datasets import hub

    convert(client, "local/stack")
    monkeypatch.setattr(hub, "_token", lambda: "hf_test")
    monkeypatch.setattr(hub, "upload_folder", lambda *a: None)
    monkeypatch.setattr(hub, "whoami", lambda token: ("op-01", ["team-a"]))
    settings.patch_section(
        "integrations", {"version": settings.get_settings().version, "hf": {"namespace": "vla-lab"}}
    )
    with pytest.raises(Exception, match="cannot upload to 'vla-lab'"):
        service.upload("local/stack")
    h = service.require("local/stack").hub
    assert h.pushing is False and "Clear the namespace" in h.error
    settings.patch_section(
        "integrations", {"version": settings.get_settings().version, "hf": {"namespace": "team-a"}}
    )  # an org of the user
    assert service.upload("local/stack") == "team-a/local-stack"


def test_push_empty_namespace_uses_the_token_user(client, recs, monkeypatch):
    from app.services.datasets import hub

    convert(client, "local/stack")
    monkeypatch.setattr(hub, "_token", lambda: "hf_test")
    monkeypatch.setattr(hub, "upload_folder", lambda *a: None)
    monkeypatch.setattr(hub, "whoami", lambda token: ("op-01", []))
    assert service.upload("local/stack") == "op-01/local-stack"


def test_push_shows_why_the_hub_refused(client, recs, monkeypatch):
    import httpx
    from huggingface_hub.errors import HfHubHTTPError

    from app.services.datasets import hub

    convert(client, "local/stack")
    monkeypatch.setattr(hub, "_token", lambda: "hf_test")

    def refuse(*a):
        resp = httpx.Response(403, request=httpx.Request("POST", "https://huggingface.co"))
        raise HfHubHTTPError(
            "(Request ID: Root=1-abc)\n\n403 Forbidden: You don't have the rights to create a"
            ' dataset under the namespace "vla-lab".',
            response=resp,
        )

    monkeypatch.setattr(hub, "upload_folder", refuse)
    with pytest.raises(Exception):
        service.upload("local/stack")
    err = service.require("local/stack").hub.error
    assert err.startswith("Hugging Face refused the request:") and "rights to create" in err

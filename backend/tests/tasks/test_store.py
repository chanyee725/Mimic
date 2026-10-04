"""data/tasks/<id>.yaml persistence; collected is counted from recordings, never stored."""

import logging

import pytest
import yaml

from app.core import storage
from app.services import tasks as service
from app.services.tasks import store
from tests.conftest import add_tasks

TASK = "stack-two-blocks"


def _file(task_id):
    return storage.path("tasks", f"{task_id}.yaml")


def _doc(task_id):
    return yaml.safe_load(_file(task_id).read_text())


def _new_body(client, task_id, name):
    body = client.get(f"/tasks/{TASK}").json()
    for k in ("collected", "version", "updatedAt", "updatedBy"):
        body.pop(k)
    return body | {"id": task_id, "name": name}


def test_no_seeds():
    assert service.list_tasks() == []
    assert not storage.path("tasks").exists()  # nothing written on load


def test_create_writes_file(client):
    add_tasks(TASK)
    r = client.post("/tasks", json=_new_body(client, "fold-towel", "Fold towel"))
    assert r.status_code == 201
    doc = _doc("fold-towel")
    assert doc["task_id"] == "fold-towel" and doc["name"] == "Fold towel"
    assert list(doc)[-1] == "meta"
    assert doc["meta"] == {
        "version": 1,
        "updated_at": r.json()["updatedAt"],
        "updated_by": "OP-01",
    }


def test_meta_round_trip():
    add_tasks()
    for task in service.list_tasks():
        assert store.loads(store.dumps(task)) == task


def test_update_duplicate_delete_on_disk(client):
    add_tasks()
    body = client.get(f"/tasks/{TASK}").json()
    body["name"] = "Stack blocks"
    r = client.put(f"/tasks/{TASK}", json=body, headers={"X-Operator": "OP-03"})
    assert r.status_code == 200
    doc = _doc(TASK)
    assert doc["name"] == "Stack blocks"
    assert (doc["meta"]["version"], doc["meta"]["updated_by"]) == (2, "OP-03")
    assert "collected" not in doc["meta"]

    r = client.post(f"/tasks/{TASK}/duplicate", json={"id": "stack-copy", "name": "Copy"})
    assert r.status_code == 201
    assert _doc("stack-copy")["name"] == "Copy"

    assert client.delete("/tasks/sort-by-color").status_code == 204
    assert not _file("sort-by-color").exists()


def test_import_ignores_meta(client):
    add_tasks(TASK)
    text = store.dumps(service.get_task(TASK)).replace(TASK, "stack-again")
    text = text.replace("version: 1", "version: 9")
    r = client.post("/tasks/import", content=text, headers={"Content-Type": "text/yaml"})
    assert r.status_code == 201
    assert (r.json()["version"], r.json()["collected"]) == (1, 0)
    assert _doc("stack-again")["meta"]["version"] == 1


def test_restart_reloads_files(client):
    add_tasks()
    client.post(f"/tasks/{TASK}/duplicate", json={"id": "stack-copy", "name": "Copy"})
    client.delete("/tasks/sort-by-color")
    # Hand edit on disk
    p = _file(TASK)
    p.write_text(p.read_text().replace("name: Stack two blocks", "name: Edited by hand"))
    service.reset()
    assert service.get_task(TASK).name == "Edited by hand"
    assert service.get_task("stack-copy").name == "Copy"
    assert service.get_task("sort-by-color") is None


def test_broken_file_skipped(caplog):
    add_tasks()
    count = len(service.list_tasks())
    _file("broken").write_text("task_id: [unclosed\n")
    _file(TASK).write_text(_file(TASK).read_text().replace("video_fps: 30", "video_fps: fast"))
    with caplog.at_level(logging.WARNING):
        service.reset()
    assert len(service.list_tasks()) == count - 1
    assert service.get_task(TASK) is None
    assert "broken.yaml" in caplog.text and f"{TASK}.yaml" in caplog.text


def test_file_name_mismatch_uses_content(caplog):
    add_tasks(TASK)
    _file(TASK).rename(_file("renamed"))
    with caplog.at_level(logging.WARNING):
        service.reset()
    assert service.get_task(TASK) is not None
    assert service.get_task("renamed") is None
    assert _file(TASK).exists() and not _file("renamed").exists()
    assert "renamed.yaml" in caplog.text


def test_empty_folder_stays_empty():
    add_tasks()
    for p in storage.list_yaml("tasks"):
        p.unlink()
    service.reset()
    assert service.list_tasks() == []


def test_old_collected_key_is_ignored():
    add_tasks(TASK)
    p = _file(TASK)
    p.write_text(p.read_text().replace("  version: 1\n", "  version: 1\n  collected: 46\n"))
    service.reset()
    assert service.get_task(TASK).collected == 0


@pytest.mark.usefixtures("task")
def test_collected_counts_real_recordings(client, record):
    assert client.get(f"/tasks/{TASK}").json()["collected"] == 0
    a = record()
    b = record(outcome="fail")
    rows = {t["id"]: t for t in client.get("/tasks").json()}
    assert rows[TASK]["collected"] == 2
    # Rejected episodes do not count; the version is not touched
    client.patch(f"/recordings/{b['id']}", json={"review": "rejected"})
    t = client.get(f"/tasks/{TASK}").json()
    assert (t["collected"], t["version"]) == (1, 1)
    client.delete(f"/recordings/{a['id']}")
    assert client.get(f"/tasks/{TASK}").json()["collected"] == 0
    assert "collected" not in _doc(TASK)["meta"]

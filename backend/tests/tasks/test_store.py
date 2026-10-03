import logging

import yaml

from app.core import storage
from app.services import tasks as service
from app.services.tasks import store

TASK = "stack-two-blocks"


def _file(task_id):
    return storage.path("tasks", f"{task_id}.yaml")


def _doc(task_id):
    return yaml.safe_load(_file(task_id).read_text())


def test_seed_writes_every_task_file():
    names = sorted(p.stem for p in storage.list_yaml("tasks"))
    assert names == sorted(t.id for t in service.list_tasks())
    doc = _doc(TASK)
    assert doc["task_id"] == TASK
    assert list(doc)[-1] == "meta"
    task = service.get_task(TASK)
    assert doc["meta"] == {
        "version": task.version,
        "collected": task.collected,
        "updated_at": task.updated_at,
        "updated_by": task.updated_by,
    }


def test_meta_round_trip():
    for task in service.list_tasks():
        assert store.loads(store.dumps(task)) == task


def test_create_update_duplicate_delete_on_disk(client):
    body = client.get(f"/tasks/{TASK}").json()
    body["name"] = "Stack blocks"
    assert (
        client.put(f"/tasks/{TASK}", json=body, headers={"X-Operator": "OP-03"}).status_code == 200
    )
    doc = _doc(TASK)
    assert doc["name"] == "Stack blocks"
    assert (doc["meta"]["version"], doc["meta"]["updated_by"]) == (4, "OP-03")

    r = client.post(f"/tasks/{TASK}/duplicate", json={"id": "stack-copy", "name": "Copy"})
    assert r.status_code == 201
    assert _doc("stack-copy")["name"] == "Copy"

    new = {
        k: v for k, v in body.items() if k not in ("collected", "version", "updatedAt", "updatedBy")
    }
    new.update(id="fold-towel", name="Fold towel")
    assert client.post("/tasks", json=new).status_code == 201
    assert _doc("fold-towel")["meta"]["version"] == 1

    assert client.delete("/tasks/sort-by-color").status_code == 204
    assert not _file("sort-by-color").exists()


def test_import_ignores_meta(client):
    text = store.dumps(service.get_task(TASK)).replace(TASK, "stack-again")
    text = text.replace("version: 3", "version: 9")
    r = client.post("/tasks/import", content=text, headers={"Content-Type": "text/yaml"})
    assert r.status_code == 201
    assert (r.json()["version"], r.json()["collected"]) == (1, 0)
    assert _doc("stack-again")["meta"]["version"] == 1


def test_bump_collected_rewrites_file():
    before = service.get_task(TASK)
    service.bump_collected(TASK)
    doc = _doc(TASK)
    assert doc["meta"]["collected"] == before.collected + 1
    assert doc["meta"]["version"] == before.version


def test_restart_reloads_files(client):
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
    count = len(service.list_tasks())
    _file("broken").write_text("task_id: [unclosed\n")
    _file(TASK).write_text(_file(TASK).read_text().replace("video_fps: 30", "video_fps: fast"))
    with caplog.at_level(logging.WARNING):
        service.reset()
    assert len(service.list_tasks()) == count - 1
    assert service.get_task(TASK) is None
    assert "broken.yaml" in caplog.text and f"{TASK}.yaml" in caplog.text


def test_file_name_mismatch_uses_content(caplog):
    _file(TASK).rename(_file("renamed"))
    with caplog.at_level(logging.WARNING):
        service.reset()
    assert service.get_task(TASK) is not None
    assert service.get_task("renamed") is None
    assert _file(TASK).exists() and not _file("renamed").exists()
    assert "renamed.yaml" in caplog.text


def test_empty_folder_is_not_reseeded():
    for p in storage.list_yaml("tasks"):
        p.unlink()
    service.reset()
    assert service.list_tasks() == []


def test_reload_keeps_seed_order():
    before = [t.id for t in service.list_tasks()]
    service.reset()
    assert [t.id for t in service.list_tasks()] == before

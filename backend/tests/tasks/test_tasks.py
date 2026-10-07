import copy

import pytest

from tests.conftest import add_tasks

TASK = "stack-two-blocks"


@pytest.fixture(autouse=True)
def fixture_tasks(request):
    # Every fixture task (tests/fixtures/tasks) except for the empty-start test
    if "empty" not in request.node.name:
        add_tasks()


@pytest.fixture
def new_task(client):
    body = copy.deepcopy(client.get(f"/tasks/{TASK}").json())
    for k in ("collected", "version", "updatedAt"):
        body.pop(k)
    body.update(id="fold-towel", name="Fold towel", status="draft")
    return body


def errors(r):
    return r.json()["error"]["details"]["errors"]


def test_empty_start(client):
    assert client.get("/tasks").json() == []
    assert client.get("/sessions").json() == []
    assert client.get(f"/tasks/{TASK}").status_code == 404


def test_list_tasks(client):
    r = client.get("/tasks")
    assert r.status_code == 200
    assert len(r.json()) == 6
    assert r.json()[0]["updatedAt"].endswith("+09:00")


def test_list_tasks_by_status(client):
    rows = client.get("/tasks", params={"status": "draft"}).json()
    assert rows and all(t["status"] == "draft" for t in rows)
    assert client.get("/tasks", params={"status": "nope"}).status_code == 422


def test_get_task(client):
    r = client.get(f"/tasks/{TASK}")
    assert r.json()["rigId"] == "so101-kit"
    assert list(r.json())[0] == "id"
    r = client.get("/tasks/missing")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"


def test_create_task(client, new_task):
    r = client.post("/tasks", json=new_task)
    assert r.status_code == 201
    t = r.json()
    assert (t["version"], t["collected"]) == (1, 0) and "updatedBy" not in t
    assert client.get("/tasks/fold-towel").status_code == 200


def test_create_task_existing_id(client, new_task):
    new_task["id"] = TASK
    assert client.post("/tasks", json=new_task).status_code == 409


@pytest.mark.parametrize(
    "patch,field",
    [
        ({"rigId": "nope"}, "rigId"),
        ({"cameras": ["top", "side"]}, "cameras"),
        ({"actionHz": 45}, "actionHz"),
        ({"videoFps": 60}, "videoFps"),
        ({"subtasks": [{"key": "1", "name": "a", "description": ""}] * 2}, "subtasks"),
    ],
)
def test_create_task_rig_rules(client, new_task, patch, field):
    r = client.post("/tasks", json={**new_task, **patch})
    assert r.status_code == 422
    assert errors(r)[0]["loc"][1] == field


def test_create_task_schema_errors(client, new_task):
    assert client.post("/tasks", json={**new_task, "id": "Bad Id"}).status_code == 422
    assert client.post("/tasks", json={**new_task, "targetEpisodes": 0}).status_code == 422


def test_update_task(client):
    body = client.get(f"/tasks/{TASK}").json()
    body["name"] = "Stack blocks"
    r = client.put(f"/tasks/{TASK}", json=body)
    assert r.status_code == 200
    t = r.json()
    assert (t["name"], t["version"], t["collected"]) == ("Stack blocks", 2, 0)


def test_update_task_stale_version(client):
    body = client.get(f"/tasks/{TASK}").json()
    assert client.put(f"/tasks/{TASK}", json=body).status_code == 200
    r = client.put(f"/tasks/{TASK}", json=body)
    assert r.status_code == 409
    assert r.json()["error"]["details"]["current"]["version"] == 2


def test_update_task_errors(client):
    body = client.get(f"/tasks/{TASK}").json()
    assert client.put("/tasks/missing", json=body).status_code == 404
    assert client.put(f"/tasks/{TASK}", json={**body, "id": "other"}).status_code == 422
    assert client.put(f"/tasks/{TASK}", json={**body, "videoFps": 25}).status_code == 422
    body.pop("version")
    assert client.put(f"/tasks/{TASK}", json=body).status_code == 422


def test_duplicate_task(client):
    r = client.post(f"/tasks/{TASK}/duplicate", json={"id": "stack-copy", "name": "Copy"})
    assert r.status_code == 201
    t = r.json()
    assert (t["status"], t["collected"], t["version"], t["rigId"]) == ("draft", 0, 1, "so101-kit")


def test_duplicate_task_errors(client):
    body = {"id": "stack-copy", "name": "Copy"}
    assert client.post("/tasks/missing/duplicate", json=body).status_code == 404
    assert client.post(f"/tasks/{TASK}/duplicate", json={**body, "id": TASK}).status_code == 409
    assert client.post(f"/tasks/{TASK}/duplicate", json={"id": "x"}).status_code == 422


def test_delete_task(client):
    assert client.delete("/tasks/sort-by-color").status_code == 204
    assert client.get("/tasks/sort-by-color").status_code == 404
    assert client.delete("/tasks/sort-by-color").status_code == 404


def test_delete_task_with_recordings(client, record):
    record()
    r = client.delete(f"/tasks/{TASK}")
    assert r.status_code == 409
    assert r.json()["error"]["details"]["recordings"] == 1


def test_task_yaml(client):
    r = client.get(f"/tasks/{TASK}/yaml")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/yaml")
    assert "task_id: stack-two-blocks" in r.text
    assert "push_to_hub: private" in r.text
    assert client.get("/tasks/missing/yaml").status_code == 404


def _import(client, text):
    return client.post("/tasks/import", content=text, headers={"Content-Type": "text/yaml"})


def test_import_round_trip(client):
    text = client.get(f"/tasks/{TASK}/yaml").text.replace(TASK, "stack-again")
    r = _import(client, text)
    assert r.status_code == 201
    src, t = client.get(f"/tasks/{TASK}").json(), r.json()
    assert t["id"] == "stack-again" and t["version"] == 1 and t["collected"] == 0
    for k in ("instruction", "cameras", "subtasks", "outcomes", "repoId", "pushToHub"):
        assert t[k] == src[k]


def test_import_minimal(client):
    text = """
task_id: wave
name: Wave
label: wave at the camera
rig: so101-kit
cameras: [top]
rates: { action_hz: 30, video_fps: 15 }
episode: { target: 10, duration_s: 20, reset_s: 5, countdown_s: 3 }
output:
  repo_id: local/wave
"""
    t = _import(client, text).json()
    assert t["status"] == "draft" and t["pushToHub"] is False
    assert [o["value"] for o in t["outcomes"]] == ["success", "fail", "partial"]


def test_import_line_errors(client):
    text = client.get(f"/tasks/{TASK}/yaml").text.replace(TASK, "x2")
    lines = text.splitlines()
    target = next(i for i, ln in enumerate(lines) if ln.strip().startswith("target:")) + 1
    r = _import(client, text.replace("target: 50", "target: 0"))
    assert r.status_code == 422
    assert errors(r)[0]["line"] == target

    cams = next(i for i, ln in enumerate(lines) if ln == "- wrist") + 1
    r = _import(client, text.replace("- wrist", "- side"))
    assert r.status_code == 422
    assert errors(r)[0]["line"] == cams


def test_import_bad_yaml_and_conflict(client):
    r = _import(client, "task_id: [\n")
    assert r.status_code == 422 and errors(r)[0]["line"] >= 1
    assert _import(client, "- a\n- b\n").status_code == 422
    assert _import(client, client.get(f"/tasks/{TASK}/yaml").text).status_code == 409

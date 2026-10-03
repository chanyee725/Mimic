"""Cross-area read services load the seeds."""

from app.datasets.service import list_datasets
from app.models.service import list_models
from app.recordings.service import list_recordings
from app.rigs.service import get_rig, list_devices
from app.tasks.service import get_task, list_tasks


def test_seeds_load():
    assert len(list_tasks()) == 6
    assert get_task("stack-two-blocks").rig_id == "so101-kit"
    assert get_rig("so101-kit").joints[0] == "shoulder_pan"
    assert list_devices()
    assert list_models()[0].saved_at.startswith("2026-")
    assert any(d.kind == "mcap" for d in list_datasets())
    rec = list_recordings("stack-two-blocks")[0]
    assert rec.model_dump(by_alias=True)["topics"][0]["schema"]

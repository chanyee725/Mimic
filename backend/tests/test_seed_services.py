"""Cross-area read services load the seeds."""

from app.services.datasets import list_datasets
from app.services.models import list_models
from app.services.recordings import list_recordings
from app.services.rigs import get_rig, list_devices
from app.services.tasks import get_task, list_tasks


def test_seeds_load():
    assert len(list_tasks()) == 6
    assert get_task("stack-two-blocks").rig_id == "so101-kit"
    assert get_rig("so101-kit").joints[0] == "shoulder_pan"
    assert list_devices()
    # Recordings, datasets and models come from disk only (none in a fresh data folder)
    assert list_models() == [] and list_datasets() == [] and list_recordings() == []

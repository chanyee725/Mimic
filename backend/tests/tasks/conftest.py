import pytest

from app.rigs import service as rigs
from app.settings import service as settings
from app.station import service as station
from app.tasks import service as tasks


@pytest.fixture(autouse=True)
def _reset():
    for s in (rigs, tasks, station, settings):
        s.reset()

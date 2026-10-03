import pytest

from app.services import rigs as rigs
from app.services import settings as settings
from app.services import station as station
from app.services import tasks as tasks


@pytest.fixture(autouse=True)
def _reset():
    for s in (rigs, tasks, station, settings):
        s.reset()

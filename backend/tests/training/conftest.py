import pytest

from app.models import service as models
from app.training import service as training


@pytest.fixture(autouse=True)
def _reset():
    models.reset()
    training.reset()

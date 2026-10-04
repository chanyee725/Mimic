import pytest

from app.services import models as models
from app.services import training as training


@pytest.fixture(autouse=True)
def _reset():
    models.reset()
    training.reset()

import pytest

from app.services import evaluate as evaluate
from app.services import models as models


@pytest.fixture(autouse=True)
def _reset():
    models.reset()
    evaluate.reset()

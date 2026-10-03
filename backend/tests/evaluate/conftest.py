import pytest

from app.evaluate import service as evaluate
from app.models import service as models


@pytest.fixture(autouse=True)
def _reset():
    models.reset()
    evaluate.reset()

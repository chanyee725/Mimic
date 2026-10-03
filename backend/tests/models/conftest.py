import pytest

from app.models import service as models


@pytest.fixture(autouse=True)
def _reset():
    models.reset()

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def client() -> TestClient:
    """Fresh app per test; services that hold state expose reset() for tests."""
    return TestClient(create_app(), base_url="http://test/api/v1")

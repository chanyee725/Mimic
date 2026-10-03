"""Write-only secrets and connection tests."""

from fastapi import APIRouter

from app.models.settings import Secret, SecretName
from app.schemas.settings import ConnTestResult, SecretValue, TestTarget
from app.services import settings as service

router = APIRouter()


@router.put("/secrets/{name}", response_model=Secret, response_model_exclude_none=True)
def put_secret(name: SecretName, body: SecretValue):
    return service.put_secret(name, body.value)


@router.delete("/secrets/{name}", response_model=Secret, response_model_exclude_none=True)
def delete_secret(name: SecretName):
    return service.delete_secret(name)


@router.post("/test/{target}", response_model=ConnTestResult, response_model_exclude_none=True)
def test_connection(target: TestTarget):
    return service.run_test(target)

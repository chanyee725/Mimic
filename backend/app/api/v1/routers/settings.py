"""Settings endpoints — see docs/api/settings.md."""

from typing import Any

from fastapi import APIRouter, Body

from app.services import settings as service
from app.schemas.settings import (
    ConnTestResult,
    Disk,
    Secret,
    SecretName,
    SecretValue,
    Section,
    Settings,
    ShortcutGroup,
    TestTarget,
    VersionRow,
)

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=Settings)
def get_settings():
    return service.get_settings()


@router.get("/disk", response_model=Disk)
def disk():
    return service.disk()


@router.get("/shortcuts", response_model=list[ShortcutGroup])
def shortcuts():
    return service.shortcuts()


@router.get("/versions", response_model=list[VersionRow])
def versions():
    return service.versions()


@router.put("/secrets/{name}", response_model=Secret, response_model_exclude_none=True)
def put_secret(name: SecretName, body: SecretValue):
    return service.put_secret(name, body.value)


@router.delete("/secrets/{name}", response_model=Secret, response_model_exclude_none=True)
def delete_secret(name: SecretName):
    return service.delete_secret(name)


@router.post("/test/{target}", response_model=ConnTestResult, response_model_exclude_none=True)
def test_connection(target: TestTarget):
    return service.run_test(target)


# Declared last so /disk etc. are not taken as a section
@router.patch("/{section}", response_model=Settings)
def patch_section(section: Section, body: dict[str, Any] = Body(...)):
    return service.patch_section(section, body)

"""Station settings: read, disk, shortcuts, versions and section patches."""

from typing import Any

from fastapi import APIRouter, Body

from app.models.settings import Section, Settings
from app.schemas.settings import Disk, ShortcutGroup, VersionRow
from app.services import settings as service

router = APIRouter()


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


# Declared after the fixed paths so /disk etc. are not taken as a section
@router.patch("/{section}", response_model=Settings)
def patch_section(section: Section, body: dict[str, Any] = Body(...)):
    return service.patch_section(section, body)

"""Recordings endpoints — see docs/api/recordings.md."""

from fastapi import APIRouter, Query, Response, UploadFile

from app.core.errors import ApiError, not_found
from app.core.schemas import Page
from app.recordings import service
from app.recordings.schemas import (
    Recording,
    RecordingReview,
    RecordingSource,
    ReviewPatch,
    Samples,
)

router = APIRouter(prefix="/recordings", tags=["recordings"])


@router.get("", response_model=Page[Recording])
def list_recordings(
    task_id: str | None = Query(None, alias="taskId"),
    review: RecordingReview | None = None,
    source: RecordingSource | None = None,
    limit: int = Query(50, ge=1, le=500),
    cursor: str | None = None,
):
    return service.page_recordings(task_id, review, source, limit, cursor)


@router.post("/import", status_code=201, response_model=Recording)
async def import_recording(file: UploadFile):
    return service.import_mcap(file.filename or "", await file.read())


@router.get("/{recording_id}", response_model=Recording)
def get_recording(recording_id: str):
    return service.require(recording_id)


@router.patch("/{recording_id}", response_model=Recording)
def patch_recording(recording_id: str, body: ReviewPatch):
    return service.set_review(recording_id, body.review)


@router.delete("/{recording_id}", status_code=204)
def delete_recording(recording_id: str):
    service.delete(recording_id)
    return Response(status_code=204)


@router.get("/{recording_id}/file")
def download_file(recording_id: str):
    service.require(recording_id)
    raise ApiError(501, "MCAP storage is not available yet")


@router.get("/{recording_id}/samples", response_model=Samples)
def get_samples(
    recording_id: str,
    topics: str = "action,state",
    from_s: float = Query(0, alias="fromS", ge=0),
    to_s: float | None = Query(None, alias="toS", ge=0),
    hz: float = Query(60, gt=0, le=1000),
):
    names = [t.strip() for t in topics.split(",") if t.strip()]
    return service.samples(recording_id, names, from_s, to_s, hz)


@router.get("/{recording_id}/video/{camera}")
def get_video(recording_id: str, camera: str):
    rec = service.require(recording_id)
    if not service.has_camera(rec, camera):
        raise not_found("Camera", camera)
    raise ApiError(501, "Video extraction is not available yet")

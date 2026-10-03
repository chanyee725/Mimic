"""Recordings: paged list, import, review, samples and media."""

from fastapi import APIRouter, Query, Response, UploadFile

from app.api.deps import Pagination, TaskIdFilter
from app.models.recordings import Recording, RecordingReview, RecordingSource
from app.schemas.common import Page
from app.schemas.recordings import ReviewPatch, Samples
from app.services import recordings as service

router = APIRouter()


@router.get("", response_model=Page[Recording])
def list_recordings(
    page: Pagination,
    task_id: TaskIdFilter = None,
    review: RecordingReview | None = None,
    source: RecordingSource | None = None,
):
    return service.page_recordings(task_id, review, source, page.limit, page.cursor)


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
    return service.file(recording_id)


@router.get("/{recording_id}/samples", response_model=Samples)
def get_samples(
    recording_id: str,
    topics: str = "action,state",
    from_s: float = Query(0, alias="fromS", ge=0),
    to_s: float | None = Query(None, alias="toS", ge=0),
    hz: float = Query(60, gt=0, le=1000),
):
    return service.samples(recording_id, topics, from_s, to_s, hz)


@router.get("/{recording_id}/video/{camera}")
def get_video(recording_id: str, camera: str):
    return service.video(recording_id, camera)

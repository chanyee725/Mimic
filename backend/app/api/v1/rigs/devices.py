"""Devices: list, detail, ports, connection test and calibration."""

import asyncio
import threading
from collections.abc import Iterator

from fastapi import APIRouter, Response
from fastapi.responses import StreamingResponse
from starlette.concurrency import run_in_threadpool

from app.core.errors import ApiError
from app.models.rigs import CalibrationSession, Device, Port
from app.schemas.rigs import PortUpdate
from app.services import rigs as service

router = APIRouter()


@router.get("/devices", response_model=list[Device])
def list_devices():
    return service.list_devices()


# Before /devices/{device_id}
@router.get("/devices/ports", response_model=list[Port])
def scan_ports():
    return service.scan_ports()


PREVIEW_PERIOD_S = 1 / 12
BOUNDARY = "frame"


def _part(jpeg: bytes) -> bytes:
    head = f"--{BOUNDARY}\r\nContent-Type: image/jpeg\r\nContent-Length: {len(jpeg)}\r\n\r\n"
    return head.encode() + jpeg + b"\r\n"


class _Frames:
    """Frame iterator safe to close from another thread: close() waits for a read in flight."""

    def __init__(self, it: Iterator[bytes]):
        self._it, self._lock = it, threading.Lock()

    def next(self) -> bytes | None:
        with self._lock:
            return next(self._it, None)

    def close(self) -> None:
        with self._lock:
            self._it.close()


@router.get("/devices/ports/preview", response_class=StreamingResponse)
async def preview_port(path: str):
    """Live MJPEG preview of a video port; the camera is released when the client goes away."""
    frames = _Frames(await run_in_threadpool(service.preview_frames, path))
    # Pull the first frame now so an unreadable camera is an error, not an empty stream
    first = await run_in_threadpool(frames.next)
    if first is None:
        await run_in_threadpool(frames.close)
        raise ApiError(503, f"No frames from {path}")

    async def stream():
        try:
            frame = first
            while frame is not None:
                yield _part(frame)
                await asyncio.sleep(PREVIEW_PERIOD_S)
                frame = await run_in_threadpool(frames.next)
        finally:
            # Not awaited: on disconnect the scope is cancelled and any await here would be too
            threading.Thread(target=frames.close, daemon=True).start()

    return StreamingResponse(stream(), media_type=f"multipart/x-mixed-replace; boundary={BOUNDARY}")


@router.get("/devices/{device_id}", response_model=Device)
def get_device(device_id: str):
    return service.require_device(device_id)


@router.put("/devices/{device_id}/port", response_model=Device)
def set_port(device_id: str, body: PortUpdate):
    return service.set_port(device_id, body.port)


# Sync handlers run in the thread pool: the test blocks for about a second
@router.post("/devices/{device_id}/test", response_model=Device)
def test_device(device_id: str):
    return service.test_device(device_id)


@router.post("/devices/{device_id}/calibrate", response_model=CalibrationSession, status_code=201)
def calibrate_device(device_id: str):
    return service.start_calibration(device_id)


@router.get("/devices/{device_id}/calibration", response_model=CalibrationSession)
def calibration_state(device_id: str):
    return service.calibration_state(device_id)


@router.post("/devices/{device_id}/calibration/next", response_model=CalibrationSession)
def next_calibration_step(device_id: str):
    return service.next_calibration_step(device_id)


@router.delete("/devices/{device_id}/calibration", status_code=204)
def cancel_calibration(device_id: str):
    service.cancel_calibration(device_id)
    return Response(status_code=204)

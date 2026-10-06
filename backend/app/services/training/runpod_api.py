"""RunPod REST API (https://rest.runpod.io/v1): pods and network volumes.

The API key comes from .env (RUNPOD_API_KEY). Every call raises ApiError so routes and the
remote trainer can report it as is (424 when the key is missing, 502 when RunPod fails).
"""

from typing import Any

import httpx

from app.core.errors import ApiError
from app.services import settings

BASE = "https://rest.runpod.io/v1"
TIMEOUT_S = 20


def key_set() -> bool:
    return settings.has_secret("runpod_api_key")


def _call(method: str, path: str, body: dict | None = None) -> Any:
    key = settings.secret_value("runpod_api_key")
    if not key:
        raise ApiError(424, "RunPod API key is not set", {"secret": "runpod_api_key"})
    try:
        r = httpx.request(
            method,
            BASE + path,
            json=body,
            headers={"Authorization": f"Bearer {key}"},
            timeout=TIMEOUT_S,
        )
    except httpx.HTTPError as e:
        raise ApiError(502, "RunPod request failed", {"reason": str(e)}) from e
    if r.status_code == 401:
        raise ApiError(424, "RunPod rejected the API key", {"secret": "runpod_api_key"})
    if r.status_code == 404:
        raise ApiError(404, "RunPod pod or volume not found", {"path": path})
    if r.status_code >= 400:
        raise ApiError(
            502, "RunPod request failed", {"status": r.status_code, "reason": r.text[:500]}
        )
    return r.json() if r.content else None


def create_pod(spec: dict[str, Any]) -> dict[str, Any]:
    """POST /pods with a PodCreateInput; returns the pod (id, costPerHr, desiredStatus…)."""
    return _call("POST", "/pods", spec)


def get_pod(pod_id: str) -> dict[str, Any]:
    return _call("GET", f"/pods/{pod_id}")


def stop_pod(pod_id: str) -> None:
    _call("POST", f"/pods/{pod_id}/stop")


def delete_pod(pod_id: str) -> None:
    """Terminates the pod (billing ends); a pod that is already gone counts as terminated."""
    try:
        _call("DELETE", f"/pods/{pod_id}")
    except ApiError as e:
        if e.status != 404:
            raise


def network_volumes() -> list[dict[str, Any]]:
    """[{id, name, size, dataCenterId}] of the account."""
    return _call("GET", "/networkvolumes") or []


def proxy_url(pod_id: str, port: int) -> str:
    """HTTPS proxy RunPod puts in front of a pod's HTTP port."""
    return f"https://{pod_id}-{port}.proxy.runpod.net"

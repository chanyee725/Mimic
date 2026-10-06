"""Pull: download a LeRobot v3.0 dataset repo from the Hugging Face Hub into the datasets folder.

meta/info.json is fetched first so a missing repo or a non-v3.0 dataset fails the request itself;
the remaining files download in a background job (same partial-folder flow as Convert), with
progress by bytes. The HF token from .env is used when set (needed for private repos).
"""

import shutil
import tempfile
from collections.abc import Callable
from pathlib import Path
from typing import Any

from huggingface_hub import HfApi, hf_hub_download
from huggingface_hub.errors import GatedRepoError, HfHubHTTPError, RepositoryNotFoundError

from app.core.errors import ApiError
from app.models.datasets import Dataset, Hub
from app.services import settings
from app.services.datasets import datasets as store
from app.services.datasets import lerobot as lr
from app.utils.time import now_iso

SKIP = (".gitattributes",)


def _token() -> str | None:
    return settings.secret_value("hf_token")


# --- Hub access (patched in tests) ---


def repo_files(repo_id: str, token: str | None) -> tuple[list[tuple[str, int]], bool]:
    """(path, size) of every file in the dataset repo, and whether the repo is private."""
    info = HfApi(token=token).dataset_info(repo_id, files_metadata=True)
    files = [(s.rfilename, s.size or 0) for s in info.siblings or []]
    return files, bool(info.private)


def download(repo_id: str, filename: str, local_dir: Path, token: str | None) -> None:
    hf_hub_download(repo_id, filename, repo_type="dataset", local_dir=local_dir, token=token)


# --- pull ---


def _hub_error(repo_id: str, e: Exception) -> ApiError:
    if isinstance(e, GatedRepoError):
        return ApiError(
            403, "Dataset is gated on the Hub: accept its terms first", {"repoId": repo_id}
        )
    if isinstance(e, RepositoryNotFoundError):
        hint = "" if _token() else " (private repos need the Hugging Face token)"
        return ApiError(
            404, f"Dataset '{repo_id}' was not found on the Hub{hint}", {"repoId": repo_id}
        )
    return ApiError(502, "Hugging Face Hub request failed", {"reason": str(e)})


def _read_remote_info(repo_id: str, token: str | None) -> dict[str, Any]:
    with tempfile.TemporaryDirectory() as tmp:
        download(repo_id, lr.INFO_PATH, Path(tmp), token)
        return lr.read_info(Path(tmp))


def pull(repo_id: str) -> Dataset:
    """Starts downloading repo_id into datasets/<repo_id>; returns it as converting (pulled)."""
    store.check_new(repo_id)
    token = _token()
    try:
        files, private = repo_files(repo_id, token)
        if lr.INFO_PATH not in {f for f, _ in files}:
            raise ApiError(
                422, "Not a LeRobot dataset: meta/info.json is missing", {"repoId": repo_id}
            )
        info = _read_remote_info(repo_id, token)
    except lr.FormatError as e:
        raise ApiError(422, f"Not a LeRobot v3.0 dataset: {e}", {"repoId": repo_id}) from e
    except (HfHubHTTPError, OSError) as e:
        raise _hub_error(repo_id, e) from e

    files = [(f, n) for f, n in files if f not in SKIP]
    hub = Hub(pushed=True, private=private, pulled=True)
    ds = Dataset(
        kind="lerobot",
        repo_id=repo_id,
        task_id=store.UNKNOWN,
        rig_id=info.get("robot_type") or store.UNKNOWN,
        format=store.FORMAT,
        fps=int(info["fps"]),
        status="converting",
        progress=0,
        created_at=now_iso(),
        size_gb=0,
        hub=hub,
        features=store.api_features(info["features"]),
        episode_count=int(info.get("total_episodes", 0)),
    )

    def build(tmp: Path, progress: Callable[[int], None]) -> dict[str, Any]:
        total = sum(n for _, n in files) or 1
        done = 0
        for name, size in files:
            download(repo_id, name, tmp, token)
            done += size
            progress(min(99, done * 100 // total))
        shutil.rmtree(tmp / ".cache", ignore_errors=True)  # hf_hub_download bookkeeping
        lr.read_info(tmp)
        # Keep the uploader's station.yaml (task, notes, episode sources) when the repo has one
        side = store.read_sidecar(tmp)
        return {
            **side,
            "rig_id": side.get("rig_id") or ds.rig_id,
            "created_at": side.get("created_at") or ds.created_at,
            "hub": hub.model_dump(),
        }

    return store.start_job(ds, build)

"""Hugging Face Hub: push a dataset folder to a dataset repo, pull one back.

Push uploads the whole folder (station.yaml included, so a pull restores the task) to
<hf namespace>/<name> (a pulled dataset keeps its repo) and tags it with the codebase version,
which lerobot looks for when it loads a dataset from the Hub. It runs in a thread; the dataset
shows hub.pushing meanwhile. RunPod jobs call upload() directly.

Pull: meta/info.json is fetched first so a missing repo or a non-v3.0 dataset fails the request itself;
the remaining files download in a background job (same partial-folder flow as Convert), with
progress by bytes. The HF token from .env is used when set (needed for private repos).
"""

import logging
import shutil
import tempfile
import threading
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

log = logging.getLogger(__name__)

SKIP = (".gitattributes",)
_push_lock = threading.Lock()


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


def upload_folder(folder: Path, repo: str, private: bool, token: str) -> None:
    """Creates the dataset repo if needed, uploads the folder and (re)points the version tag."""
    api = HfApi(token=token)
    api.create_repo(repo, repo_type="dataset", private=private, exist_ok=True)
    api.upload_folder(
        repo_id=repo,
        repo_type="dataset",
        folder_path=folder,
        ignore_patterns=[".*", "**/.*"],
        commit_message="Upload from Mimic",
    )
    try:
        api.delete_tag(repo, tag=lr.CODEBASE_VERSION, repo_type="dataset")
    except HfHubHTTPError:
        pass  # no tag yet
    api.create_tag(repo, tag=lr.CODEBASE_VERSION, repo_type="dataset")


def whoami(token: str) -> str:
    return HfApi(token=token).whoami()["name"]


# --- push ---


def require_token() -> str:
    token = _token()
    if not token:
        raise ApiError(424, "Hugging Face token is not set", {"secret": "hf_token"})
    return token


def namespace(token: str) -> str:
    """Settings → Hugging Face namespace, else the token's user."""
    ns = settings.get_settings().integrations.hf.namespace.strip()
    if ns:
        return ns
    try:
        return whoami(token)
    except (HfHubHTTPError, OSError) as e:
        raise _hub_error("whoami", e) from e


def hub_repo(ds: Dataset, token: str) -> str:
    """Pushed / pulled repo, else <hf ns>/<name>, or <hf ns>/<local ns>-<name> when the local
    namespace differs, so two local datasets with the same name never share a Hub repo."""
    if ds.hub.repo:
        return ds.hub.repo
    if ds.hub.pulled:
        return ds.repo_id
    ns = namespace(token)
    local_ns, name = ds.repo_id.split("/", 1)
    return f"{ns}/{name}" if local_ns == ns else f"{ns}/{local_ns}-{name}"


def upload(repo_id: str, private: bool | None = None) -> str:
    """Uploads a ready dataset now (blocking) and returns its Hub repo; skipped when already
    pushed. Raises ApiError; the dataset's hub state follows (pushing, then pushed or error)."""
    token = require_token()
    ds = store.require(repo_id)
    if ds.status != "ready":
        raise ApiError(409, f"Dataset is {ds.status}", {"status": ds.status})
    with _push_lock:
        ds = store.require(repo_id)
        if ds.hub.pushed and ds.hub.repo and private is None:
            return ds.hub.repo
        private = ds.hub.private if private is None else private
        store.set_hub(repo_id, ds.hub.model_copy(update={"pushing": True, "error": None}), False)
        repo = ds.hub.repo or repo_id
        try:
            repo = hub_repo(ds, token)  # may call the Hub (whoami): inside, so pushing is cleared
            upload_folder(store.folder(repo_id), repo, private, token)
        except Exception as e:  # any failure is reported on the dataset
            log.warning("Push of %s to %s failed: %s", repo_id, repo, e)
            if isinstance(e, ApiError):
                err = e
            elif isinstance(e, (HfHubHTTPError, OSError)):
                err = _hub_error(repo, e)
            else:
                err = None
            msg = err.message if err else str(e) or type(e).__name__
            store.set_hub(
                repo_id, ds.hub.model_copy(update={"pushing": False, "error": msg}), False
            )
            raise err or ApiError(502, msg) from e
        hub = ds.hub.model_copy(
            update={
                "pushed": True,
                "private": private,
                "repo": repo,
                "pushing": False,
                "error": None,
            }
        )
        store.set_hub(repo_id, hub)
        return repo


def push(repo_id: str, private: bool) -> Dataset:
    """Starts uploading the dataset in a thread; returns it with hub.pushing."""
    ds = store.require(repo_id)
    if ds.status != "ready":
        raise ApiError(409, f"Dataset is {ds.status}", {"status": ds.status})
    if ds.hub.pushing:
        raise ApiError(409, "Dataset is already being pushed", {"repoId": repo_id})
    require_token()

    def run() -> None:
        try:
            upload(repo_id, private)
        except ApiError:
            pass  # kept on the dataset as hub.error

    ds = store.set_hub(repo_id, ds.hub.model_copy(update={"pushing": True, "error": None}), False)
    threading.Thread(target=run, name=f"push:{repo_id}", daemon=True).start()
    return ds


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
    hub = Hub(pushed=True, private=private, pulled=True, repo=repo_id)
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
            "hub": hub.model_dump(exclude={"pushing", "error"}),
        }

    return store.start_job(ds, build)

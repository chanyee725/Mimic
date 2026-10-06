"""RunPod trainer: runs a job on a rented pod and follows it like a local run.

Start (one thread per job): push the dataset to the Hub (datasets.upload), create the pod with
pod_runner.py as its start command, then poll the runner through RunPod's proxy every POLL_S:
the log is appended to the job's train.log and parsed by local.follow (same step / metric /
epoch handling as a local run), and every checkpoint the runner uploaded to the job's private
model repo is downloaded into output/checkpoints/<step>/pretrained_model, so Save to Models and
Evaluate work as for local jobs. When the runner reports a final phase the station acks it,
terminates the pod (or leaves it idle) and, without pushToHub, deletes the model repo.

The pod also ends itself (runner deadline, ack timeout), so a station that is down does not leave
it billing. job.yaml keeps the runner token, model repo and log offset (extras()), so a restarted
backend follows the pod again.
"""

import base64
import gzip
import json
import logging
import secrets
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime
from importlib import metadata
from pathlib import Path
from typing import Any

import httpx
from huggingface_hub import HfApi, snapshot_download
from huggingface_hub.errors import HfHubHTTPError

from app.core.errors import ApiError
from app.models.training import Checkpoint, PodState, TrainJob
from app.schemas.training import RunPodOptions
from app.services import datasets
from app.services.training import config as cfg
from app.services.training import local, params, runpod_api
from app.utils.time import now_iso

log = logging.getLogger(__name__)

POLL_S = 3.0
POD_CHECK_S = 30.0  # RunPod API: pod still running, actual rate
BOOT_TIMEOUT_S = 25 * 60  # pod created → runner answers (image pull + start)
LOST_TIMEOUT_S = 10 * 60  # runner answered before, silent since
PUBLISH_EVERY_S = 3.0
FINAL = ("done", "failed", "stopped")
RUNNER = Path(__file__).with_name("pod_runner.py")
WORKDIR = "/workspace/mimic"  # on the network volume when there is one
LOCAL_VENV = "/opt/mimic-venv"


@dataclass
class Remote:
    job: TrainJob
    token: str
    model_repo: str
    options: RunPodOptions
    run: local.Run
    port: int
    pod_offset: int = 0
    stop: threading.Event = field(default_factory=threading.Event)
    cancel: threading.Event = field(default_factory=threading.Event)  # reset(): thread exits
    stop_sent: bool = False
    pod_since: float | None = None  # wall clock the pod was created (cost)
    created: float | None = None  # monotonic, same moment
    last_seen: float | None = None
    last_pod_check: float = 0.0
    published: float = 0.0
    thread: threading.Thread | None = None


_remotes: dict[str, Remote] = {}
_lock = threading.RLock()


def reset() -> None:
    """Forgets the followed jobs (tests); their threads exit, pods are left alone."""
    with _lock:
        for r in _remotes.values():
            r.cancel.set()
        _remotes.clear()


def is_following(job_id: str) -> bool:
    with _lock:
        return job_id in _remotes


def extras(job_id: str) -> dict[str, Any] | None:
    """What job.yaml keeps besides the TrainJob (never sent to the web)."""
    with _lock:
        r = _remotes.get(job_id)
        if r is None:
            return None
        return {
            "token": r.token,
            "model_repo": r.model_repo,
            "pod_offset": r.pod_offset,
            "port": r.port,
            "pod_since": r.pod_since,
            "options": r.options.model_dump(by_alias=True),
        }


# --- runner and Hub access (patched in tests) ---


def _runner_url(r: Remote, name: str) -> str:
    return f"{runpod_api.proxy_url(r.job.pod or '', r.port)}/{r.token}/{name}"


def runner_status(r: Remote) -> dict[str, Any] | None:
    """The runner's status, or None while it does not answer (booting, proxy error)."""
    try:
        resp = httpx.get(_runner_url(r, "status"), timeout=10)
        return resp.json() if resp.status_code == 200 else None
    except (httpx.HTTPError, ValueError):
        return None


def runner_log(r: Remote, offset: int) -> bytes:
    resp = httpx.get(_runner_url(r, "log"), params={"offset": offset}, timeout=30)
    resp.raise_for_status()
    return resp.content


def runner_post(r: Remote, name: str) -> bool:
    try:
        return httpx.post(_runner_url(r, name), timeout=10).status_code == 200
    except httpx.HTTPError:
        return False


def download_checkpoint(r: Remote, dirname: str) -> Path:
    snapshot_download(
        r.model_repo,
        allow_patterns=[f"checkpoints/{dirname}/pretrained_model/*"],
        local_dir=local.output_dir(r.job.id),
        token=datasets.hf_token(),
    )
    return local.output_dir(r.job.id) / "checkpoints" / dirname / "pretrained_model"


def delete_model_repo(repo: str) -> None:
    HfApi(token=datasets.hf_token()).delete_repo(repo, missing_ok=True)


# --- start ---


def lerobot_spec() -> str:
    pod = cfg.raw("RUNPOD_POD")
    try:
        version = metadata.version("lerobot")
    except metadata.PackageNotFoundError:
        version = pod["lerobot"]
    return f"lerobot[{pod['extras']}]=={version}"


def model_repo(job: TrainJob, namespace: str) -> str:
    task = (job.task_id or "task").replace("-", "_")
    return f"{namespace}/smolvla_{task}_{job.id}"


def start(job: TrainJob, options: RunPodOptions, cap_hours: float) -> None:
    """Registers the job and starts its thread (push → pod → follow). Keys are checked first."""
    if not runpod_api.key_set():
        raise ApiError(424, "RunPod API key is not set", {"secret": "runpod_api_key"})
    namespace = datasets.hf_namespace(datasets.hf_token())
    r = Remote(
        job=job,
        token=secrets.token_hex(16),
        model_repo=model_repo(job, namespace),
        options=options,
        run=_new_run(job),
        port=int(cfg.raw("RUNPOD_POD")["port"]),
    )
    with _lock:
        _remotes[job.id] = r
    local.job_dir(job.id).mkdir(parents=True, exist_ok=True)
    r.thread = threading.Thread(
        target=_launch, args=(r, cap_hours), name=f"runpod:{job.id}", daemon=True
    )
    r.thread.start()


def _new_run(job: TrainJob, known: int = 0) -> local.Run:
    freq = int(job.overrides.get("log_freq", params.DEFAULTS["log_freq"]))
    return local.Run(job, None, 0, freq, -1, known=known, remote=True)


def reattach(job: TrainJob, raw: dict[str, Any] | None) -> bool:
    """Follows a running RunPod job again after a restart; False when it cannot be."""
    if not raw or not job.pod:
        return False
    try:
        options = RunPodOptions.model_validate(raw["options"])
        r = Remote(
            job=job,
            token=raw["token"],
            model_repo=raw["model_repo"],
            options=options,
            run=_new_run(job, known=len(local.load_samples(job.id))),
            port=int(raw.get("port") or cfg.raw("RUNPOD_POD")["port"]),
            pod_offset=int(raw.get("pod_offset") or 0),
            pod_since=raw.get("pod_since"),
        )
    except (KeyError, TypeError, ValueError) as e:
        log.warning("Cannot follow %s again: %s", job.id, e)
        return False
    r.created = time.monotonic()
    with _lock:
        _remotes[job.id] = r
    r.thread = threading.Thread(target=_guard, args=(r, _follow), daemon=True)
    r.thread.start()
    return True


def say(job_id: str, msg: str) -> None:
    with local.log_path(job_id).open("a") as f:
        f.write(f"[station] {msg}\n")


def _guard(r: Remote, fn, *args) -> None:
    try:
        fn(r, *args)
    except _Cancelled:
        return
    except ApiError as e:
        _fail(r, e.message)
    except Exception as e:  # any failure ends the job as failed
        log.exception("RunPod job %s failed", r.job.id)
        _fail(r, str(e) or type(e).__name__)


class _Cancelled(Exception):
    pass


def _check_cancel(r: Remote) -> None:
    if r.cancel.is_set():
        raise _Cancelled


def _launch(r: Remote, cap_hours: float) -> None:
    _guard(r, _launch_steps, cap_hours)


def _launch_steps(r: Remote, cap_hours: float) -> None:
    job = r.job
    _phase(r, "pushing dataset")
    say(job.id, f"Pushing {job.dataset} to the Hugging Face Hub")
    dataset_repo = datasets.upload(job.dataset)
    _check_cancel(r)
    if r.stop.is_set():
        _end(r, "stopped", None)
        return
    _phase(r, "starting pod")
    spec = pod_spec(r, dataset_repo, cap_hours)
    say(job.id, f"Creating a {job.gpu} pod ({spec['cloudType'].lower()} cloud)")
    pod = runpod_api.create_pod(spec)
    job.pod = pod["id"]
    if rate := pod.get("adjustedCostPerHr") or pod.get("costPerHr"):
        job.price_per_hr = round(float(rate), 4)
    r.pod_since, r.created = time.time(), time.monotonic()
    job.pod_state = PodState(
        state="running", auto_terminate=r.options.terminate_on_finish, since=now_iso()
    )
    say(job.id, f"Pod {job.pod} created; waiting for it to start (image pull, lerobot install)")
    local._cb.save(job)
    local._cb.updated(job)
    _follow(r)


def pod_spec(r: Remote, dataset_repo: str, cap_hours: float) -> dict[str, Any]:
    """PodCreateInput for the job (docs: rest.runpod.io/v1 POST /pods)."""
    o, job = r.options, r.job
    gpu = next(g for g in cfg.runpod_gpus() if g.name == job.gpu)
    pod = cfg.raw("RUNPOD_POD")
    volume = cfg.network_volume(o.volume)
    workdir = WORKDIR if volume else "/mimic"
    venv = f"/workspace/mimic-venv-{lerobot_spec().rsplit('==', 1)[-1]}" if volume else LOCAL_VENV
    dataset_root = f"{workdir}/datasets/{dataset_repo}"
    runner_job = {
        "jobId": job.id,
        "token": r.token,
        "port": r.port,
        "workdir": workdir,
        "venv": venv,
        "lerobot": lerobot_spec(),
        "datasetRepo": dataset_repo,
        "datasetRoot": dataset_root,
        "modelRepo": r.model_repo,
        "trainArgs": cfg.train_args(
            job.dataset,
            {**job.overrides, "steps": job.total, "batch_size": job.batch},
            repo_id=dataset_repo,
            root="{dataset_root}",
        ),
        "gpuCount": o.gpu_count,
        "capHours": cap_hours,
        "terminateOnFinish": o.terminate_on_finish,
    }
    env = {
        "MIMIC_JOB": json.dumps(runner_job),
        "MIMIC_RUNNER": base64.b64encode(gzip.compress(RUNNER.read_bytes())).decode(),
        "HF_TOKEN": datasets.hf_token(),
    }
    if volume:
        env["HF_HOME"] = "/workspace/.cache/huggingface"
    spec: dict[str, Any] = {
        "name": f"mimic-{job.id}",
        "imageName": pod["image"],
        "gpuTypeIds": [gpu.type_id],
        "gpuCount": o.gpu_count,
        "cloudType": o.cloud.upper(),
        "interruptible": o.pricing == "spot",
        "containerDiskInGb": o.disk_gb,
        "ports": [f"{r.port}/http"],
        "env": env,
        "dockerEntrypoint": ["bash", "-c"],
        "dockerStartCmd": [
            'echo "$MIMIC_RUNNER" | base64 -d | gunzip > /mimic_runner.py'
            " && exec python3 /mimic_runner.py"
        ],
    }
    if volume:
        spec["networkVolumeId"] = volume["id"]
        spec["dataCenterIds"] = [volume["dataCenterId"]]
    else:
        spec["volumeInGb"] = 0
        if o.region != "any":
            spec["dataCenterIds"] = [o.region]
    return spec


# --- follow ---


def _phase(r: Remote, phase: str) -> None:
    if r.job.phase != phase:
        r.job.phase = phase
        local._cb.save(r.job)
        local._cb.updated(r.job)


def _follow(r: Remote) -> None:
    job = r.job
    while True:
        _check_cancel(r)
        now = time.monotonic()
        if r.stop.is_set() and not r.stop_sent:
            if r.last_seen is not None and runner_post(r, "stop"):
                r.stop_sent = True
                say(job.id, "Stop sent to the pod")
            elif r.last_seen is None:
                say(job.id, "Stopped before the pod answered; terminating it")
                _end(r, "stopped", None, force_terminate=True)
                return
        st = runner_status(r)
        if st is None:
            ref = r.last_seen or r.created or now
            limit = LOST_TIMEOUT_S if r.last_seen else BOOT_TIMEOUT_S
            if now - ref > limit:
                what = "stopped answering" if r.last_seen else "did not start in time"
                _end(r, "failed", f"Pod {job.pod} {what}", force_terminate=True)
                return
        else:
            r.last_seen = now
            r.run.util = st.get("gpuUtil")
            _pull_log(r, int(st.get("logSize") or 0))
            local.follow(r.run)
            phase = st.get("phase") or job.phase
            _collect(r, st.get("checkpoints") or [])
            if phase in FINAL:
                local.follow(r.run, final=True)
                _end(r, phase, st.get("error"))
                return
            _phase(r, phase)
        if now - r.last_pod_check > POD_CHECK_S:
            r.last_pod_check = now
            if not _pod_alive(r):
                return
        _costs(r)
        if time.monotonic() - r.published > PUBLISH_EVERY_S:
            r.published = time.monotonic()
            local._cb.updated(job)
        r.cancel.wait(POLL_S)


def _pull_log(r: Remote, size: int) -> None:
    while r.pod_offset < size:
        chunk = runner_log(r, r.pod_offset)
        if not chunk:
            return
        with local.log_path(r.job.id).open("ab") as f:
            f.write(chunk)
        r.pod_offset += len(chunk)
        local._cb.save(r.job)


def _collect(r: Remote, uploaded: list[dict[str, Any]]) -> None:
    have = {c.step for c in r.job.checkpoints}
    for c in uploaded:
        step = int(c["step"])
        if step in have:
            continue
        d = download_checkpoint(r, c["dir"])
        size = sum(p.stat().st_size for p in d.rglob("*") if p.is_file()) if d.is_dir() else 0
        ckpt = Checkpoint(step=step, saved_at=now_iso(), size_mb=round(size / 1_000_000, 1))
        r.job.checkpoints = [*r.job.checkpoints, ckpt]
        say(r.job.id, f"Checkpoint {c['dir']} downloaded")
        local._cb.save(r.job)
        local._cb.updated(r.job)


def _pod_alive(r: Remote) -> bool:
    """False (and the job failed) when RunPod says the pod is gone, e.g. a spot interruption."""
    try:
        pod = runpod_api.get_pod(r.job.pod or "")
    except ApiError as e:
        if e.status != 404:
            log.warning("RunPod check of %s failed: %s", r.job.pod, e.message)
            return True
        pod = {"desiredStatus": "TERMINATED"}
    if rate := pod.get("adjustedCostPerHr") or pod.get("costPerHr"):
        r.job.price_per_hr = round(float(rate), 4)
    status = pod.get("desiredStatus")
    if status in ("EXITED", "TERMINATED"):
        _end(r, "failed", f"Pod {r.job.pod} is {status.lower()} (interrupted or removed)")
        return False
    return True


def _costs(r: Remote) -> None:
    job = r.job
    local._elapsed(job)
    if r.pod_since and job.price_per_hr:
        job.cost_usd = round(job.price_per_hr * (time.time() - r.pod_since) / 3600, 4)


# --- end ---


def stop(job_id: str) -> bool:
    """Asks a followed job to stop; False when this module does not follow it."""
    with _lock:
        r = _remotes.get(job_id)
    if r is None:
        return False
    r.stop.set()
    return True


def _fail(r: Remote, error: str) -> None:
    _end(r, "failed", error, force_terminate=True)


def _end(r: Remote, status: str, error: str | None, force_terminate: bool = False) -> None:
    job = r.job
    with _lock:
        if _remotes.get(job.id) is not r:
            return  # already ended (or reset)
        _remotes.pop(job.id, None)
    if error:
        say(job.id, f"Error: {error}")
    if job.pod:
        runner_post(r, "ack")
        _costs(r)
        if r.options.terminate_on_finish or force_terminate:
            try:
                runpod_api.delete_pod(job.pod)
                job.pod_state = PodState(state="terminated", auto_terminate=True, since=now_iso())
                say(job.id, f"Pod {job.pod} terminated")
            except ApiError as e:
                log.warning("Could not terminate %s: %s", job.pod, e.message)
                say(job.id, f"Could not terminate pod {job.pod}: {e.message}")
        else:
            job.pod_state = PodState(state="idle", auto_terminate=False, since=now_iso())
        if not r.options.push_to_hub and status != "failed":
            try:
                delete_model_repo(r.model_repo)
            except (HfHubHTTPError, OSError) as e:
                log.warning("Could not delete %s: %s", r.model_repo, e)
    job.status = status  # type: ignore[assignment]
    if status == "done":
        job.step = job.total
    job.error = error if status == "failed" else None
    job.phase, job.eta_s, job.steps_per_s = None, None, None
    local._cb.save(job)
    local._cb.updated(job)


def terminate(job: TrainJob) -> None:
    """Terminate now (an idle pod after training)."""
    if job.pod:
        runpod_api.delete_pod(job.pod)


def idle_for(job: TrainJob) -> int | None:
    if job.pod_state is None or job.pod_state.state != "idle" or not job.pod_state.since:
        return None
    since = datetime.fromisoformat(job.pod_state.since)
    return max(0, int((datetime.now(since.tzinfo) - since).total_seconds()))

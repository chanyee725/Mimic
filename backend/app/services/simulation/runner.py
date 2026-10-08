"""Isaac Sim server: started here on 127.0.0.1 (local) or a sim server reached by URL (remote).

The server (sim/runner/server.py) fronts one Isaac Sim app process that runs with a window or
headless. Opening an environment sends its script and its robot's USD as tar.gz, so a remote
server needs no copy of data/sims. A robot or tool opens alone the same way, with a generated
script that places just it. A local server is detached: it outlives backend reloads
and is found again by port.
"""

import io
import json
import os
import re
import signal
import subprocess
import tarfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from app.configs.config import REPO_ROOT, config
from app.core.errors import ApiError, not_found
from app.models.settings import IsaacSettings
from app.models.simulation import SimRunner, SimRunnerApp
from app.schemas.settings import ConnTestResult
from app.services.settings import get_settings
from app.services.simulation.envs import get_env, robot_path, tool_path

SERVER_SCRIPT = REPO_ROOT / "sim" / "runner" / "server.py"
# Overridden in tests (a fake app instead of Isaac Sim, a temp cache)
APP_SCRIPT: Path | None = None
CACHE_DIR: Path = Path.home() / ".cache" / "mimic-sim"

HEALTH_TIMEOUT_S = 1.0
REQUEST_TIMEOUT_S = 30.0
SERVER_START_S = 10.0
MAX_ENV_BYTES = 512 * 1024 * 1024
PREVIEW_SCRIPT = "preview.py"
# Servers older than this lack /joints jog or /state joints (teleoperation); a local one is restarted
JOINTS_VERSION = 8
# A tool stands this high above the floor when opened alone (m)
TOOL_PREVIEW_Z = 0.3
# Relative asset paths in text USD layers: @./x.usd@, @../tools/hand/hand.usda@
ASSET_PATH_RE = re.compile(r"@(\.\.?/[^@]+)@")
USD_TEXT_SUFFIXES = (".usda", ".usd")
USDA_MAGIC = b"#usda"

_lock = threading.Lock()
_server: dict[str, subprocess.Popen] = {}


def _settings() -> IsaacSettings:
    return get_settings().connection.isaac


def _python(s: IsaacSettings) -> Path:
    p = Path(s.python).expanduser()
    return p if p.is_absolute() else REPO_ROOT / p


def base_url(s: IsaacSettings | None = None) -> str:
    s = s or _settings()
    return f"http://127.0.0.1:{s.port}" if s.mode == "local" else s.url.strip().rstrip("/")


def _request(path: str, body: bytes | None = None, content_type: str = "application/json") -> dict:
    url = base_url() + path
    headers = {"Content-Type": content_type} if body is not None else {}
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_S) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            detail = json.loads(e.read()).get("error") or e.reason
        except ValueError:
            detail = e.reason
        raise ApiError(502, f"Isaac Sim server: {detail}")
    except OSError as e:
        raise ApiError(503, f"Isaac Sim server is not reachable at {base_url()}: {e}")


def _health(timeout: float = HEALTH_TIMEOUT_S) -> dict | None:
    try:
        with urllib.request.urlopen(base_url() + "/health", timeout=timeout) as r:
            return json.loads(r.read())
    except (OSError, ValueError):
        return None


def _local_server_pids(port: int) -> list[int]:
    """Processes running this repo's server.py on the port (Linux /proc)."""
    pids = []
    for cmdline in Path("/proc").glob("[0-9]*/cmdline"):
        try:
            args = cmdline.read_bytes().split(b"\0")
        except OSError:
            continue
        argv = [a.decode(errors="replace") for a in args if a]
        if str(SERVER_SCRIPT) in argv and "--port" in argv:
            i = argv.index("--port")
            if i + 1 < len(argv) and argv[i + 1] == str(port):
                pids.append(int(cmdline.parent.name))
    return pids


def _stop_outdated(port: int) -> None:
    """A local server from an older checkout (no /joints) is stopped; it stops its app too."""
    for pid in _local_server_pids(port):
        try:
            os.kill(pid, signal.SIGTERM)
        except OSError:
            pass
    deadline = time.monotonic() + SERVER_START_S * 3
    while _health() and time.monotonic() < deadline:
        time.sleep(0.2)
    if _health():
        raise ApiError(503, f"An outdated Isaac Sim server on port {port} did not stop")


def _ensure_server() -> None:
    """Local mode: start the server when nothing answers on its port (restarting one older than
    JOINTS_VERSION)."""
    s = _settings()
    if s.mode != "local":
        return
    health = _health()
    if health and int(health.get("version") or 0) >= JOINTS_VERSION:
        return
    if health:
        _stop_outdated(s.port)
    python = _python(s)
    if not python.exists():
        raise ApiError(
            503, f"Isaac Sim Python not found at {python}. Install it with `cd sim && uv sync`."
        )
    with _lock:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        cmd = [str(python), str(SERVER_SCRIPT), "--host", "127.0.0.1", "--port", str(s.port)]
        cmd += ["--cache", str(CACHE_DIR)]
        if APP_SCRIPT:
            cmd += ["--app", str(APP_SCRIPT)]
        with open(CACHE_DIR / "server.log", "wb") as log:
            proc = subprocess.Popen(
                cmd, stdout=log, stderr=subprocess.STDOUT, start_new_session=True
            )
        _server["local"] = proc
    deadline = time.monotonic() + SERVER_START_S
    while time.monotonic() < deadline:
        if _health():
            return
        if proc.poll() is not None:
            break
        time.sleep(0.2)
    raise ApiError(503, f"Isaac Sim server did not start; see {CACHE_DIR / 'server.log'}")


def stop_local_server() -> None:
    """Stops a server this process started (tests; the UI stops only the app)."""
    with _lock:
        proc = _server.pop("local", None)
    if proc and proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=20)
        except subprocess.TimeoutExpired:
            proc.kill()


def status() -> SimRunner:
    s = _settings()
    health = _health()
    app = SimRunnerApp.model_validate(health["app"]) if health else None
    return SimRunner(
        mode=s.mode,
        display=s.display,
        device=s.device,
        url=base_url(s),
        reachable=health is not None,
        app=app,
    )


def start(display: str | None = None) -> SimRunner:
    _ensure_server()
    s = _settings()
    body = {"display": display or s.display, "device": s.device}
    _request("/app/start", json.dumps(body).encode())
    return status()


def stop() -> SimRunner:
    if _health():
        _request("/app/stop", b"{}")
    return status()


def _files(path: Path) -> list[Path]:
    if path.is_file():
        return [path]
    return [p for p in sorted(path.rglob("*")) if p.is_file() and "__pycache__" not in p.parts]


def _asset_files(usd: Path) -> list[Path]:
    """A robot or tool: its folder when it has one (<id>/<id>.usd), else the file."""
    return _files(usd.parent if usd.parent.name == usd.stem else usd)


def _asset_of(path: Path) -> Path | None:
    """The robots/<x> or tools/<x> folder (or single file) a path under the sim folder is in."""
    try:
        parts = path.resolve().relative_to(config.sim_dir.resolve()).parts
    except ValueError:
        return None
    if len(parts) < 2 or parts[0] not in ("robots", "tools"):
        return None
    asset = config.sim_dir / parts[0] / parts[1]
    return asset if asset.exists() else None


def _referenced_assets(files: list[Path]) -> set[Path]:
    """Assets the text layers among files point at by relative paths (@./…@, @../…@)."""
    found: set[Path] = set()
    for f in files:
        if f.suffix not in USD_TEXT_SUFFIXES:
            continue
        with f.open("rb") as fh:
            if fh.read(len(USDA_MAGIC)) != USDA_MAGIC:
                continue  # a binary (crate) layer
        for ref in ASSET_PATH_RE.findall(f.read_text(errors="replace")):
            asset = _asset_of(f.parent / ref)
            if asset is not None:
                found.add(asset)
    return found


def _usd_files(usd: Path) -> list[Path]:
    """A robot or tool with every robots/<x> or tools/<x> its text layers reference by relative
    path (e.g. an arm and a hand composed into one robot), recursively; nothing outside the sim
    folder."""
    files = _asset_files(usd)
    first = usd.parent if usd.parent.name == usd.stem else usd
    seen, queue = {first.resolve()}, [files]
    while queue:
        for asset in sorted(_referenced_assets(queue.pop())):
            if asset.resolve() in seen:
                continue
            seen.add(asset.resolve())
            more = _files(asset)
            files += more
            queue.append(more)
    return files


def _archive(path: Path | None, robot: Path | None = None, script: str | None = None) -> bytes:
    """The environment (folder or single script) and the robot's USD (its folder when it has
    one) as tar.gz, laid out as under the sim folder (envs/…, robots/…). script, when given,
    goes in as preview.py at the top."""
    root = config.sim_dir
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for p in (_files(path) if path else []) + (_usd_files(robot) if robot else []):
            tar.add(p, arcname=str(p.relative_to(root)))
        if script is not None:
            data = script.encode()
            info = tarfile.TarInfo(PREVIEW_SCRIPT)
            info.size, info.mtime = len(data), int(time.time())
            tar.addfile(info, io.BytesIO(data))
    if buf.tell() > MAX_ENV_BYTES:
        raise ApiError(422, f"Environment folder is larger than {MAX_ENV_BYTES >> 20} MB")
    return buf.getvalue()


def open_env(env_id: str, display: str | None = None) -> SimRunner:
    """Sends the environment to the server, which builds its stage (starting the app if needed).
    The robot placed is its first robot tag (none when untagged)."""
    env = get_env(env_id)
    path = Path(env.path)
    robot = env.robots[0] if env.robots else ""
    robot_file = robot_path(robot) if robot else None
    if robot and robot_file is None:
        raise ApiError(422, f"Robot '{robot}' has no USD under {config.sim_robots_dir}")
    body = _archive(path, robot_file)
    _ensure_server()
    s = _settings()
    script = path.relative_to(config.sim_dir) / (env.script if path.is_dir() else "")
    query = urllib.parse.urlencode(
        {
            "env": env_id,
            "script": script.as_posix(),
            "robot": robot,
            "display": display or s.display,
            "device": s.device,
        }
    )
    _request(f"/scene?{query}", body, "application/gzip")
    return status()


def scene_id(kind: str, asset_id: str) -> str:
    """The app's scene name while a robot or tool is open alone: robot-<id> / tool-<id>."""
    return f"{kind}-{asset_id}"


def open_asset(kind: str, asset_id: str, display: str | None = None) -> SimRunner:
    """Opens one robot (kind "robot", pinned at the origin) or tool ("tool", pinned above the
    floor) on an empty stage, to look at how its USD is built."""
    if kind == "robot":
        usd, script = robot_path(asset_id), "def build(scene):\n    scene.robot()\n"
    else:
        usd = tool_path(asset_id)
        script = f"def build(scene):\n    scene.tool({asset_id!r}, pos=(0, 0, {TOOL_PREVIEW_Z}))\n"
    if usd is None:
        raise not_found(kind.capitalize(), asset_id)
    body = _archive(None, usd, script)
    _ensure_server()
    s = _settings()
    query = urllib.parse.urlencode(
        {
            "env": scene_id(kind, asset_id),
            "script": PREVIEW_SCRIPT,
            "robot": asset_id if kind == "robot" else "",
            "display": display or s.display,
            "device": s.device,
        }
    )
    _request(f"/scene?{query}", body, "application/gzip")
    return status()


def is_local() -> bool:
    return _settings().mode == "local"


def server_version() -> int | None:
    health = _health()
    return int(health.get("version") or 0) if health else None


def send_joints(targets: dict[str, float], percent: list[str], play: bool = False) -> None:
    """Teleoperation: drive targets of the open robot by joint name (degrees; percent joints
    0–100 over their limits). 409 from the server while the app is not running."""
    body = {"targets": targets, "percent": percent, "play": play}
    _request("/joints", json.dumps(body).encode())


def send_jog(
    velocities: dict[str, float], twist: list[float] | None = None, play: bool = False
) -> None:
    """Keyboard teleoperation: move these joints at degrees per second, or the TCP by twist (its
    own frame; m/s, deg/s). The app stops at the limits, and when no command comes for a moment."""
    body = {"twist": twist} if twist else {"jog": velocities}
    _request("/joints", json.dumps(body | {"play": play}).encode())


def check() -> ConnTestResult:
    """Server health with its latency; locally an installed Python also counts (it starts on demand)."""
    s = _settings()
    start_t = time.perf_counter()
    health = _health(timeout=3.0)
    if health:
        ms = round((time.perf_counter() - start_t) * 1000)
        return ConnTestResult(state="ok", latency_ms=ms)
    if s.mode == "remote":
        return ConnTestResult(state="error", detail=f"No Isaac Sim server at {base_url(s)}")
    if not _python(s).exists():
        return ConnTestResult(state="error", detail=f"Isaac Sim Python not found: {s.python}")
    return ConnTestResult(state="ok", detail="Isaac Sim is installed; the server starts on demand")

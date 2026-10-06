"""Mimic Isaac Sim server: an HTTP front for one Isaac Sim app process.

Runs on the station (local mode: the backend starts it on 127.0.0.1) or on a sim server
(remote mode: started by hand, e.g. `sim/.venv/bin/python sim/runner/server.py --host 0.0.0.0`).
Stdlib only, so it starts instantly; the Isaac Sim app (app.py) is a child process started and
stopped through the API, headless or with a window.

API (JSON):
  GET  /health                     {"version", "app": AppState}
  POST /app/start  {"display"}     start the app ("window" | "headless"); restarts it on a display change
  POST /app/stop                   stop the app
  POST /scene?env=<id>&scene=<file>  body: tar.gz of the environment (folder files, or the single
                                   stage file); opens <file> (default scene.usd), starting the app
                                   first when it is not running
AppState = {"state": "stopped" | "starting" | "running" | "exited", "display", "pid", "scene", "error"}
"""

import argparse
import io
import json
import os
import re
import shutil
import signal
import socket
import subprocess
import sys
import tarfile
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

VERSION = 1
HERE = Path(__file__).resolve().parent
ENV_ID = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")
DISPLAYS = ("window", "headless")
MAX_SCENE_BYTES = 512 * 1024 * 1024
READY_POLL_S = 1.0
LOG_TAIL = 2000  # bytes of the app log shown when it exits


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _get(url: str, timeout: float = 1.0) -> dict:
    with urllib.request.urlopen(url, timeout=timeout) as r:
        return json.loads(r.read())


def _post(url: str, body: dict, timeout: float = 5.0) -> dict:
    req = urllib.request.Request(
        url, json.dumps(body).encode(), {"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


class App:
    """One Isaac Sim app child process; a scene asked for while it starts opens once it is ready."""

    def __init__(self, python: str, script: Path, cache: Path):
        self.python, self.script, self.cache = python, script, cache
        self.lock = threading.RLock()
        self.proc: subprocess.Popen | None = None
        self.port = 0
        self.display: str | None = None
        self.ready = False
        self.scene: str | None = None
        self.pending: tuple[str, str] | None = None  # (env id, scene path)
        self.error: str | None = None
        self.log = cache / "app.log"

    def state(self) -> dict:
        with self.lock:
            if self.proc is None:
                state = "stopped"
            elif self.proc.poll() is not None:
                state = "exited"
            else:
                state = "running" if self.ready else "starting"
            pid = self.proc.pid if self.proc and state in ("starting", "running") else None
            return {
                "state": state,
                "display": self.display,
                "pid": pid,
                "scene": self.scene if state == "running" else None,
                "error": self.error,
            }

    def start(self, display: str) -> None:
        with self.lock:
            if self.proc and self.proc.poll() is None:
                if self.display == display:
                    return
                self.stop()
            self.cache.mkdir(parents=True, exist_ok=True)
            self.port = _free_port()
            cmd = [self.python, str(self.script), "--port", str(self.port)]
            if display == "headless":
                cmd.append("--headless")
            env = {**os.environ, "OMNI_KIT_ACCEPT_EULA": "YES"}
            log = open(self.log, "wb")
            self.proc = subprocess.Popen(cmd, stdout=log, stderr=subprocess.STDOUT, env=env)
            log.close()
            self.display, self.ready, self.scene, self.error = display, False, None, None
            threading.Thread(target=self._watch, args=(self.proc,), daemon=True).start()

    def _watch(self, proc: subprocess.Popen) -> None:
        """Mark the app ready once it answers, send a pending scene, note why it exited."""
        while proc.poll() is None:
            if not self.ready:
                try:
                    _get(f"http://127.0.0.1:{self.port}/state")
                    with self.lock:
                        if self.proc is proc:
                            self.ready = True
                            self._send_pending()
                except OSError:
                    pass
            time.sleep(READY_POLL_S)
        with self.lock:
            if self.proc is proc and proc.returncode not in (0, -signal.SIGTERM):
                self.error = f"Isaac Sim exited with code {proc.returncode}: {self._log_tail()}"

    def _log_tail(self) -> str:
        try:
            data = self.log.read_bytes()[-LOG_TAIL:]
        except OSError:
            return ""
        return data.decode(errors="replace").strip().splitlines()[-1:][0] if data.strip() else ""

    def stop(self) -> None:
        with self.lock:
            proc, self.proc = self.proc, None
            self.ready, self.scene, self.pending, self.display = False, None, None, None
        if proc and proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=20)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()

    def open_scene(
        self, env_id: str, archive: bytes, display: str, scene_name: str = "scene.usd"
    ) -> None:
        folder = self.cache / "scenes" / env_id
        shutil.rmtree(folder, ignore_errors=True)
        folder.mkdir(parents=True)
        with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as tar:
            tar.extractall(folder, filter="data")
        scene = (folder / scene_name).resolve()
        if not scene.is_relative_to(folder.resolve()):
            raise ValueError("the scene path leaves the environment")
        if not scene.is_file():
            raise ValueError(f"the environment has no {scene_name}")
        with self.lock:
            self.pending = (env_id, str(scene))
            if not (self.proc and self.proc.poll() is None):
                self.start(display)
            elif self.ready:
                self._send_pending()

    def _send_pending(self) -> None:
        if not self.pending:
            return
        env_id, path = self.pending
        self.pending = None
        try:
            _post(f"http://127.0.0.1:{self.port}/open", {"path": path})
            self.scene = env_id
        except OSError as e:
            self.error = f"Could not open {env_id}: {e}"


def make_handler(app: App):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):  # quiet
            pass

        def _send(self, status: int, body: dict) -> None:
            data = json.dumps(body).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def _body(self) -> bytes:
            size = int(self.headers.get("Content-Length") or 0)
            if size > MAX_SCENE_BYTES:
                raise ValueError("body is too large")
            return self.rfile.read(size)

        def _health(self) -> dict:
            return {"version": VERSION, "app": app.state()}

        def do_GET(self):
            if urlparse(self.path).path == "/health":
                return self._send(200, self._health())
            self._send(404, {"error": "not found"})

        def do_POST(self):
            url = urlparse(self.path)
            try:
                if url.path == "/app/start":
                    display = (json.loads(self._body() or b"{}")).get("display", "window")
                    if display not in DISPLAYS:
                        return self._send(422, {"error": f"display must be one of {DISPLAYS}"})
                    app.start(display)
                elif url.path == "/app/stop":
                    app.stop()
                elif url.path == "/scene":
                    query = parse_qs(url.query)
                    env_id = query.get("env", [""])[0]
                    display = query.get("display", ["window"])[0]
                    scene = query.get("scene", ["scene.usd"])[0]
                    if not ENV_ID.match(env_id) or display not in DISPLAYS:
                        return self._send(422, {"error": "invalid env id or display"})
                    app.open_scene(env_id, self._body(), display, scene)
                else:
                    return self._send(404, {"error": "not found"})
            except (ValueError, tarfile.TarError, OSError) as e:
                return self._send(422, {"error": str(e)})
            self._send(200, self._health())

    return Handler


def main() -> None:
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=8211)
    p.add_argument("--python", default=sys.executable, help="Python that has isaacsim installed")
    p.add_argument("--app", default=str(HERE / "app.py"), help="Isaac Sim app script")
    p.add_argument("--cache", default=str(Path.home() / ".cache" / "mimic-sim"))
    args = p.parse_args()

    app = App(args.python, Path(args.app), Path(args.cache))
    server = ThreadingHTTPServer((args.host, args.port), make_handler(app))

    def shutdown(*_):
        app.stop()
        threading.Thread(target=server.shutdown, daemon=True).start()

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)
    print(f"Mimic Isaac Sim server on http://{args.host}:{args.port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()

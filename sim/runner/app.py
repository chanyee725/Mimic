"""Isaac Sim app started by server.py: opens scenes on request (evaluation comes later).

Runs with the Python that has isaacsim installed (sim/.venv). Commands arrive on a small
HTTP port that only server.py talks to; USD work runs on the main loop between app updates.

  GET  /state              {"scene": path | null, "error": str | null}
  POST /open {"path"}      open a stage
"""

import argparse
import json
import queue
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

p = argparse.ArgumentParser()
p.add_argument("--port", type=int, required=True)
p.add_argument("--headless", action="store_true")
args = p.parse_args()

# SimulationApp must start before any omni import
from isaacsim import SimulationApp  # noqa: E402

app = SimulationApp({"headless": args.headless})

import omni.usd  # noqa: E402

state = {"scene": None, "error": None}
commands: queue.Queue = queue.Queue()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, status: int, body: dict) -> None:
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        self._send(200 if self.path == "/state" else 404, dict(state))

    def do_POST(self):
        if self.path != "/open":
            return self._send(404, {})
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
        commands.put(("open", body.get("path")))
        self._send(202, dict(state))


server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()

# Runs until the window is closed or server.py terminates the process
while app.is_running():
    app.update()
    while not commands.empty():
        kind, path = commands.get()
        if kind == "open":
            ok = omni.usd.get_context().open_stage(path)
            state.update(scene=path if ok else None, error=None if ok else f"Could not open {path}")

server.shutdown()
app.close()

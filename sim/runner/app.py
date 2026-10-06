"""Isaac Sim app started by server.py: opens scenes on request (evaluation comes later).

Runs with the Python that has isaacsim installed (sim/.venv). Commands arrive on a small
HTTP port that only server.py talks to; USD work runs on the main loop between app updates.

  GET  /state              {"scene": path | null, "error": str | null}
  POST /open {"path"}      open a stage

--device gpu (default) simulates on GPU 0: PhysX GPU dynamics and broadphase are turned on in
every PhysicsScene of an opened stage (one is added when the stage has none), in the session
layer so the environment's files stay untouched; --device cpu keeps PhysX on the CPU.
Rendering is always on the NVIDIA GPU. A window app also enables the physics UI extensions
(Physics Inspector for moving joints, physics menus and properties).
"""

import argparse
import json
import queue
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

p = argparse.ArgumentParser()
p.add_argument("--port", type=int, required=True)
p.add_argument("--headless", action="store_true")
p.add_argument("--device", choices=("gpu", "cpu"), default="gpu")
args = p.parse_args()
GPU = args.device == "gpu"
UI_EXTENSIONS = ("omni.physx.ui", "omni.physx.supportui", "isaacsim.gui.property")

# SimulationApp must start before any omni import
from isaacsim import SimulationApp  # noqa: E402

app = SimulationApp({"headless": args.headless, "active_gpu": 0, "physics_gpu": 0})

# A window gets the physics authoring UI the lean default experience leaves out: Physics
# Inspector (joint sliders), physics menus and property widgets. The full experience kit
# crashes when started through SimulationApp, so only these extensions are added.
if not args.headless:
    import omni.kit.app

    manager = omni.kit.app.get_app().get_extension_manager()
    for ext in UI_EXTENSIONS:
        manager.set_extension_enabled_immediate(ext, True)

import carb  # noqa: E402
import omni.usd  # noqa: E402
from pxr import PhysxSchema, Usd, UsdPhysics  # noqa: E402

carb.settings.get_settings().set_int("/physics/cudaDevice", 0 if GPU else -1)

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


def use_physics_device(stage) -> None:
    """GPU (or CPU) PhysX on every PhysicsScene of the stage, written to the session layer."""
    prev = stage.GetEditTarget()
    stage.SetEditTarget(Usd.EditTarget(stage.GetSessionLayer()))
    try:
        scenes = [p for p in stage.Traverse() if p.IsA(UsdPhysics.Scene)]
        if not scenes:
            scenes = [UsdPhysics.Scene.Define(stage, "/physicsScene").GetPrim()]
        for prim in scenes:
            api = PhysxSchema.PhysxSceneAPI.Apply(prim)
            api.CreateEnableGPUDynamicsAttr().Set(GPU)
            api.CreateBroadphaseTypeAttr().Set("GPU" if GPU else "MBP")
    finally:
        stage.SetEditTarget(prev)


server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()

# Runs until the window is closed or server.py terminates the process
while app.is_running():
    app.update()
    while not commands.empty():
        kind, path = commands.get()
        if kind == "open":
            ok = omni.usd.get_context().open_stage(path)
            if ok:
                use_physics_device(omni.usd.get_context().get_stage())
            state.update(scene=path if ok else None, error=None if ok else f"Could not open {path}")

server.shutdown()
app.close()

"""Isaac Sim app started by server.py: builds environments on request (evaluation comes later).

Runs with the Python that has isaacsim installed (sim/.venv). Commands arrive on a small
HTTP port that only server.py talks to; USD work runs on the main loop between app updates.

  GET  /state                 {"scene": path | null, "error": str | null}
  POST /open {"path", "root", "robot"}  build a new stage from the environment script at path;
                              root is the sim folder it came from (robots/ is looked up there),
                              robot the one scene.robot() places (scene.py)
  POST /joints {"targets": {joint: value}, "percent": [joint, …], "play": bool}
                              teleoperation: leader readings by joint name, shifted by the
                              robot's leader offsets (robot.yaml leader.rest → initial_pose), then
                              set as drive targets (degrees; percent joints 0–100 over their limits);
                              play starts the timeline. Only the newest command is applied

--device gpu (default) simulates on GPU 0: PhysX GPU dynamics and broadphase are turned on in
every PhysicsScene of a built stage, in the session layer; --device cpu keeps PhysX on the CPU.
Rendering is always on the NVIDIA GPU. A window app also enables the physics UI extensions
(Physics Inspector for moving joints, physics menus and properties).
"""

import argparse
import json
import queue
import sys
import threading
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

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
import omni.timeline  # noqa: E402
import omni.usd  # noqa: E402
from pxr import PhysxSchema, Usd, UsdPhysics  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent))
import scene as env_scene  # noqa: E402

carb.settings.get_settings().set_int("/physics/cudaDevice", 0 if GPU else -1)

state = {"scene": None, "error": None}
commands: queue.Queue = queue.Queue()
# Newest teleoperation command; older ones are dropped (the main loop applies one per update)
joints: dict = {"latest": None}
joints_lock = threading.Lock()


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
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
        if self.path == "/joints":
            with joints_lock:
                joints["latest"] = body
            return self._send(202, dict(state))
        if self.path != "/open":
            return self._send(404, {})
        commands.put(("open", body.get("path"), body.get("root"), body.get("robot") or None))
        self._send(202, dict(state))


def use_physics_device(stage) -> None:
    """GPU (or CPU) PhysX on every PhysicsScene of the stage, written to the session layer."""
    prev = stage.GetEditTarget()
    stage.SetEditTarget(Usd.EditTarget(stage.GetSessionLayer()))
    try:
        for prim in [p for p in stage.Traverse() if p.IsA(UsdPhysics.Scene)]:
            api = PhysxSchema.PhysxSceneAPI.Apply(prim)
            api.CreateEnableGPUDynamicsAttr().Set(GPU)
            api.CreateBroadphaseTypeAttr().Set("GPU" if GPU else "MBP")
    finally:
        stage.SetEditTarget(prev)


server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()

def apply_joints(drives) -> None:
    with joints_lock:
        cmd, joints["latest"] = joints["latest"], None
    if not cmd or drives is None:
        return
    timeline = omni.timeline.get_timeline_interface()
    if cmd.get("play") and not timeline.is_playing():
        timeline.play()
    targets = {j: v + drives.offsets.get(j, 0.0) for j, v in (cmd.get("targets") or {}).items()}
    drives.set(targets, tuple(cmd.get("percent") or ()))


drives = None  # scene.Drives of the open stage

# Runs until the window is closed or server.py terminates the process
while app.is_running():
    app.update()
    apply_joints(drives)
    while not commands.empty():
        kind, path, root, robot = commands.get()
        if kind == "open":
            context = omni.usd.get_context()
            try:
                drives = None
                context.new_stage()
                built = env_scene.build(context.get_stage(), Path(path), Path(root), robot)
                use_physics_device(context.get_stage())
                drives = env_scene.Drives(context.get_stage())
                drives.offsets = built.leader_offsets
                state.update(scene=path, error=None)
            except Exception as e:  # the user's script: report it, keep the app up
                traceback.print_exc()
                state.update(scene=None, error=f"Could not build {Path(path).name}: {e}")

server.shutdown()
app.close()

"""Builds an environment from its Python script: `build(scene)` places assets and the robot.

An environment script (data/sims/envs/<id>.py, or <id>/env.py) only defines

    def build(scene):
        scene.add("table")
        scene.add("cube", pos=(0, 0.08, 0.75))
        scene.robot(pos=(0, -0.2, 0.75), yaw=180)

Assets come from sim/assets/<name>/<name>.usd[a] (origin at their bottom, centred). The robot is
not named in the script: it is the environment's robot tag (Environments page), loaded from the
sim folder's robot/<name>.usd[a]; scene.robot_name says which one. The robot is pinned to the world with a fixed joint, so
it stands when Play starts. Units are metres, Z up, yaw in degrees about Z. pxr only, so the
same code builds a stage with usd-core outside Isaac Sim.
"""

import importlib.util
from pathlib import Path

from pxr import Gf, Usd, UsdGeom, UsdLux, UsdPhysics

ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets"
USD_EXTS = (".usd", ".usda", ".usdc")
FLOOR_SIZE = 20.0


def _usd_file(folder: Path, name: str) -> Path:
    for ext in USD_EXTS:
        for p in (folder / name / f"{name}{ext}", folder / f"{name}{ext}"):
            if p.is_file():
                return p
    raise FileNotFoundError(f"no USD for '{name}' in {folder}")


def _place(prim: Usd.Prim, pos, yaw: float, scale: float = 1.0) -> None:
    xf = UsdGeom.Xformable(prim)
    xf.ClearXformOpOrder()
    xf.AddTranslateOp().Set(Gf.Vec3d(*pos))
    xf.AddRotateZOp().Set(float(yaw))
    if scale != 1.0:
        xf.AddScaleOp().Set(Gf.Vec3f(scale, scale, scale))


class Scene:
    """What an environment script gets: a stage with /World, physics, lights and a floor."""

    def __init__(self, stage: Usd.Stage, sim_dir: Path, robot: str | None = None):
        self.stage = stage
        self.sim_dir = sim_dir
        self.robot_name = robot
        self.robot_path: str | None = None
        UsdGeom.SetStageUpAxis(stage, UsdGeom.Tokens.z)
        UsdGeom.SetStageMetersPerUnit(stage, 1.0)
        world = UsdGeom.Xform.Define(stage, "/World")
        stage.SetDefaultPrim(world.GetPrim())
        physics = UsdPhysics.Scene.Define(stage, "/World/physicsScene")
        physics.CreateGravityDirectionAttr(Gf.Vec3f(0, 0, -1))
        physics.CreateGravityMagnitudeAttr(9.81)
        UsdLux.DomeLight.Define(stage, "/World/DomeLight").CreateIntensityAttr(1000)
        key = UsdLux.DistantLight.Define(stage, "/World/KeyLight")
        key.CreateIntensityAttr(2500)
        key.AddRotateXYZOp().Set(Gf.Vec3f(45, 0, 30))
        floor = UsdGeom.Cube.Define(stage, "/World/floor")
        floor.CreateSizeAttr(1.0)
        floor.CreateDisplayColorAttr([Gf.Vec3f(0.8, 0.8, 0.8)])
        floor.AddTranslateOp().Set(Gf.Vec3d(0, 0, -0.01))
        floor.AddScaleOp().Set(Gf.Vec3f(FLOOR_SIZE, FLOOR_SIZE, 0.02))
        UsdPhysics.CollisionAPI.Apply(floor.GetPrim())

    def _free_path(self, name: str) -> str:
        path, n = f"/World/{name}", 1
        while self.stage.GetPrimAtPath(path):
            path, n = f"/World/{name}_{n}", n + 1
        return path

    def add(
        self,
        asset: str,
        pos=(0, 0, 0),
        yaw: float = 0,
        name: str | None = None,
        scale: float = 1.0,
        color=None,
    ) -> Usd.Prim:
        """References sim/assets/<asset> at pos; color (r, g, b in 0–1) recolours its meshes."""
        prim = self.stage.DefinePrim(self._free_path(name or asset), "Xform")
        prim.GetReferences().AddReference(str(_usd_file(ASSETS_DIR, asset)))
        _place(prim, pos, yaw, scale)
        if color is not None:
            for p in Usd.PrimRange(prim):
                if p.IsA(UsdGeom.Gprim):
                    UsdGeom.Gprim(p).CreateDisplayColorAttr([Gf.Vec3f(*color)])
        return prim

    def robot(self, pos=(0, 0, 0), yaw: float = 0, name: str | None = None) -> Usd.Prim:
        """References the robot (robot/<name>, the tagged one by default) at /World/Robot, its
        base pinned where it stands."""
        if self.robot_path:
            raise ValueError("an environment places one robot")
        name = name or self.robot_name
        if not name:
            raise ValueError("no robot: tag the environment with one on the Environments page")
        prim = self.stage.DefinePrim("/World/Robot", "Xform")
        prim.GetReferences().AddReference(str(_usd_file(self.sim_dir / "robot", name)))
        _place(prim, pos, yaw)
        # A robot file may carry its own PhysicsScene; the stage keeps one
        for p in Usd.PrimRange(prim):
            if p.IsA(UsdPhysics.Scene):
                p.SetActive(False)
        self.robot_path = str(prim.GetPath())
        _pin(self.stage, prim)
        return prim


def _pin(stage: Usd.Stage, robot: Usd.Prim) -> None:
    """Fixed base: the articulation root moves from the base body to the robot Xform and a
    fixed joint ties the base to the world at its current pose."""
    roots = [p for p in Usd.PrimRange(robot) if p.HasAPI(UsdPhysics.ArticulationRootAPI)]
    bodies = [p for p in Usd.PrimRange(robot) if p.HasAPI(UsdPhysics.RigidBodyAPI)]
    base = next((p for p in roots if p.HasAPI(UsdPhysics.RigidBodyAPI)), None) or (
        bodies[0] if bodies else None
    )
    if base is None:
        return
    for p in roots:
        if p != robot:
            p.RemoveAPI(UsdPhysics.ArticulationRootAPI)
    UsdPhysics.ArticulationRootAPI.Apply(robot)
    m = UsdGeom.XformCache().GetLocalToWorldTransform(base).RemoveScaleShear()
    # Own name: robot files from URDF often carry an inactive "root_joint" that Define would reuse
    joint = UsdPhysics.FixedJoint.Define(stage, robot.GetPath().AppendChild("mimic_fixed_base"))
    joint.CreateBody1Rel().SetTargets([base.GetPath()])
    joint.CreateLocalPos0Attr(Gf.Vec3f(m.ExtractTranslation()))
    joint.CreateLocalRot0Attr(Gf.Quatf(m.ExtractRotationQuat()))
    joint.CreateLocalPos1Attr(Gf.Vec3f(0, 0, 0))
    joint.CreateLocalRot1Attr(Gf.Quatf(1, 0, 0, 0))


def build(stage: Usd.Stage, script: Path, sim_dir: Path, robot: str | None = None) -> Scene:
    """Runs the script's build(scene) on the stage."""
    spec = importlib.util.spec_from_file_location(f"mimic_env_{script.stem}", script)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if not callable(getattr(module, "build", None)):
        raise ValueError(f"{script.name} defines no build(scene)")
    scene = Scene(stage, sim_dir, robot)
    module.build(scene)
    return scene

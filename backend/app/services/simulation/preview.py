"""Static 3D preview of a robot or tool USD as glTF binary (GLB) for the web (three.js).

The composed stage is flattened to its visible render meshes (collision meshes are `guide` purpose
in these assets), baked to world space in metres and turned Z-up → Y-up. One glTF primitive per
distinct colour; no normals (the client shades flat or computes them). Results are cached under
<data>/cache/sim-models/, keyed by the asset files' sizes and mtimes.
"""

import hashlib
import json
import logging
import re
import struct
import threading
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

from app.configs.config import config
from app.core import storage
from app.core.errors import ApiError, not_found
from app.services.simulation.envs import robot_path, tool_path
from app.services.simulation.runner import usd_files

log = logging.getLogger(__name__)

CACHE_DIR = "cache/sim-models"
# Bump when the output changes so cached files are rebuilt
FORMAT = 1
GREY = (0.7, 0.7, 0.72)
MDL_COLOR_RE = r"\b{}\s*:\s*color\(\s*([\d.eE+-]+)f?\s*,\s*([\d.eE+-]+)f?\s*,\s*([\d.eE+-]+)f?\s*\)"
GLB_MAGIC, GLB_JSON, GLB_BIN = 0x46546C67, 0x4E4F534A, 0x004E4942
FLOAT, UINT32 = 5126, 5125
ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER = 34962, 34963

_lock = threading.Lock()


@dataclass
class _Group:
    """Geometry sharing one colour."""

    positions: list[np.ndarray] = field(default_factory=list)
    indices: list[np.ndarray] = field(default_factory=list)
    count: int = 0


def model(kind: str, asset_id: str) -> Path:
    """Path of the cached GLB of a robot or tool, converting it on a miss. 404 unknown id; 422
    when the USD has no visible mesh or fails to load."""
    usd = robot_path(asset_id) if kind == "robot" else tool_path(asset_id)
    if usd is None:
        raise not_found("Robot" if kind == "robot" else "Tool", asset_id)
    prefix = f"{kind}-{asset_id}-"
    out = storage.path(CACHE_DIR, f"{prefix}{_fingerprint(usd)}.glb")
    with _lock:
        if out.is_file():
            return out
        glb = convert(usd)
        for old in out.parent.glob(f"{prefix}*.glb"):
            old.unlink(missing_ok=True)
        storage.write_file(out, glb)
    return out


def _fingerprint(usd: Path) -> str:
    """Hash of every file the asset composes from (its folder and the robots / tools it
    references), so editing any of them rebuilds the preview."""
    h = hashlib.sha256(f"{FORMAT}".encode())
    for p in sorted(usd_files(usd)):
        st = p.stat()
        h.update(f"{p.relative_to(config.sim_dir)}:{st.st_size}:{st.st_mtime_ns}\n".encode())
    return h.hexdigest()[:16]


def convert(usd: Path) -> bytes:
    from pxr import Usd, UsdGeom

    try:
        stage = Usd.Stage.Open(str(usd))
        groups = _collect(stage)
    except Exception as e:  # an unreadable layer or malformed geometry somewhere in the stage
        log.exception("Converting %s failed", usd)
        raise ApiError(422, f"Cannot convert {usd.name}: {e}") from e
    if not groups:
        raise ApiError(422, f"{usd.name} has no visible mesh")
    z_up = UsdGeom.GetStageUpAxis(stage) == UsdGeom.Tokens.z
    return _glb(groups, UsdGeom.GetStageMetersPerUnit(stage), z_up)


def _collect(stage) -> dict[tuple[float, float, float], _Group]:
    from pxr import Usd, UsdGeom

    t = Usd.TimeCode.EarliestTime()
    xf = UsdGeom.XformCache(t)
    colors: dict[str, tuple[float, float, float]] = {}
    groups: dict[tuple[float, float, float], _Group] = {}
    for prim in stage.Traverse(Usd.TraverseInstanceProxies()):
        if not prim.IsA(UsdGeom.Mesh):
            continue
        img = UsdGeom.Imageable(prim)
        if img.ComputePurpose() not in (UsdGeom.Tokens.default_, UsdGeom.Tokens.render):
            continue
        if img.ComputeVisibility() == UsdGeom.Tokens.invisible:
            continue
        mesh = UsdGeom.Mesh(prim)
        points = mesh.GetPointsAttr().Get(t)
        counts = mesh.GetFaceVertexCountsAttr().Get(t)
        indices = mesh.GetFaceVertexIndicesAttr().Get(t)
        if not points or not counts or not indices:
            continue
        m = np.array(xf.GetLocalToWorldTransform(prim), dtype=np.float64)
        flip = (mesh.GetOrientationAttr().Get() == UsdGeom.Tokens.leftHanded) != (
            np.linalg.det(m[:3, :3]) < 0
        )
        tris = _triangulate(np.asarray(counts), np.asarray(indices), flip)
        if len(tris) == 0:
            continue
        pts, tris = _weld(np.asarray(points, dtype=np.float32), tris)
        pts = pts.astype(np.float64) @ m[:3, :3] + m[3, :3]
        g = groups.setdefault(_color(prim, colors), _Group())
        g.positions.append(pts)
        g.indices.append(tris + g.count)
        g.count += len(pts)
    return groups


def _triangulate(counts: np.ndarray, indices: np.ndarray, flip: bool) -> np.ndarray:
    """Fan-triangulates polygons into (n, 3) point indices."""
    starts = np.concatenate([[0], np.cumsum(counts)[:-1]])
    ntri = np.maximum(counts - 2, 0)
    first = np.repeat(starts, ntri)
    k = np.arange(ntri.sum()) - np.repeat(np.cumsum(ntri) - ntri, ntri)
    a, b, c = indices[first], indices[first + k + 1], indices[first + k + 2]
    return np.stack([a, c, b] if flip else [a, b, c], axis=1).astype(np.uint32)


def _weld(points: np.ndarray, tris: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Merges identical points: CAD exports often repeat each corner per face, tripling the size."""
    key = np.ascontiguousarray(points).view(np.dtype((np.void, 12))).ravel()
    _, first, inverse = np.unique(key, return_index=True, return_inverse=True)
    return points[first], inverse.astype(np.uint32)[tris]


def _color(prim, cache: dict[str, tuple[float, float, float]]) -> tuple[float, float, float]:
    """displayColor when authored, else the bound material's diffuse colour, else grey."""
    from pxr import UsdGeom, UsdShade

    pv = UsdGeom.PrimvarsAPI(prim).GetPrimvar("displayColor")
    if pv and pv.HasAuthoredValue() and (value := pv.Get()):
        return _rounded(np.asarray(value, dtype=np.float64).mean(axis=0))
    material = UsdShade.MaterialBindingAPI(prim).ComputeBoundMaterial()[0]
    if not material:
        return GREY
    key = str(material.GetPath())
    if key not in cache:
        cache[key] = _material_color(material) or GREY
    return cache[key]


def _material_color(material) -> tuple[float, float, float] | None:
    """UsdPreviewSurface diffuseColor, or OmniPBR's diffuse_color_constant × diffuse_tint: the
    shader's inputs, falling back to the defaults in its .mdl file."""
    for context in ("", "mdl"):
        shader = material.ComputeSurfaceSource(context)[0]
        if not shader:
            continue
        if shader.GetIdAttr().Get() == "UsdPreviewSurface":
            if (value := _input(shader, "diffuseColor")) is not None:
                return _rounded(value)
            continue
        names = ("diffuse_color_constant", "diffuse_tint")
        values = [_input(shader, n) for n in names]
        if None in values:
            defaults = _mdl_colors(shader, names)
            values = [v if v is not None else d for v, d in zip(values, defaults)]
        if any(v is not None for v in values):
            return _rounded(np.prod([np.asarray(v) for v in values if v is not None], axis=0))
    return None


def _input(shader, name: str):
    i = shader.GetInput(name)
    return i.Get() if i else None


def _mdl_colors(shader, names: tuple[str, ...]) -> list[tuple | None]:
    asset = shader.GetSourceAsset("mdl")
    path = Path(asset.resolvedPath) if asset and asset.resolvedPath else None
    if path is None or not path.is_file():
        return [None] * len(names)
    text = path.read_text(errors="replace")
    matches = [re.search(MDL_COLOR_RE.format(n), text) for n in names]
    return [tuple(float(v) for v in m.groups()) if m else None for m in matches]


def _rounded(rgb) -> tuple[float, float, float]:
    r, g, b = (round(min(max(float(v), 0.0), 1.0), 3) for v in rgb)
    return r, g, b


def _glb(groups: dict[tuple[float, float, float], _Group], meters: float, z_up: bool) -> bytes:
    gltf: dict = {
        "asset": {"version": "2.0", "generator": "mimic"},
        "scene": 0,
        "scenes": [{"nodes": list(range(len(groups)))}],
        "nodes": [],
        "meshes": [],
        "materials": [],
        "accessors": [],
        "bufferViews": [],
    }
    blob = bytearray()

    def view(data: bytes, target: int) -> int:
        gltf["bufferViews"].append(
            {"buffer": 0, "byteOffset": len(blob), "byteLength": len(data), "target": target}
        )
        blob.extend(data)
        blob.extend(b"\0" * (-len(blob) % 4))
        return len(gltf["bufferViews"]) - 1

    for i, (rgb, g) in enumerate(groups.items()):
        pos = np.concatenate(g.positions) * meters
        if z_up:
            pos = np.stack([pos[:, 0], pos[:, 2], -pos[:, 1]], axis=1)
        pos = pos.astype(np.float32)
        idx = np.concatenate(g.indices).astype(np.uint32).ravel()
        gltf["accessors"].append(
            {
                "bufferView": view(pos.tobytes(), ARRAY_BUFFER),
                "componentType": FLOAT,
                "count": len(pos),
                "type": "VEC3",
                "min": pos.min(axis=0).tolist(),
                "max": pos.max(axis=0).tolist(),
            }
        )
        gltf["accessors"].append(
            {
                "bufferView": view(idx.tobytes(), ELEMENT_ARRAY_BUFFER),
                "componentType": UINT32,
                "count": len(idx),
                "type": "SCALAR",
            }
        )
        gltf["materials"].append(
            {
                "pbrMetallicRoughness": {
                    "baseColorFactor": [*rgb, 1.0],
                    "metallicFactor": 0.0,
                    "roughnessFactor": 0.7,
                },
                "doubleSided": True,
            }
        )
        prim = {"attributes": {"POSITION": 2 * i}, "indices": 2 * i + 1, "material": i}
        gltf["meshes"].append({"primitives": [prim]})
        gltf["nodes"].append({"mesh": i})
    gltf["buffers"] = [{"byteLength": len(blob)}]

    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    total = 12 + 8 + len(js) + 8 + len(blob)
    return b"".join(
        [
            struct.pack("<III", GLB_MAGIC, 2, total),
            struct.pack("<II", len(js), GLB_JSON),
            js,
            struct.pack("<II", len(blob), GLB_BIN),
            bytes(blob),
        ]
    )

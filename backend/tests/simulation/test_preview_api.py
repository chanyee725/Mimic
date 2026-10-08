import json
import os
import struct
from pathlib import Path

import numpy as np

from app.configs.config import config

# A unit cube of quads, a hidden triangle and a guide-purpose (collision) quad: only the cube
# counts. Metres per unit 0.01 and Z up, so the cube is 1 cm tall along glTF's Y.
CUBE_USDA = """#usda 1.0
(
    defaultPrim = "Robot"
    metersPerUnit = 0.01
    upAxis = "Z"
)

def Xform "Robot"
{
    double3 xformOp:translate = (0, 0, 5)
    uniform token[] xformOpOrder = ["xformOp:translate"]

    def Mesh "cube"
    {
        int[] faceVertexCounts = [4, 4, 4, 4, 4, 4]
        int[] faceVertexIndices = [0, 1, 3, 2, 4, 6, 7, 5, 0, 4, 5, 1, 2, 3, 7, 6, 0, 2, 6, 4, 1, 5, 7, 3]
        point3f[] points = [(0, 0, 0), (1, 0, 0), (0, 1, 0), (1, 1, 0), (0, 0, 1), (1, 0, 1), (0, 1, 1), (1, 1, 1)]
        color3f[] primvars:displayColor = [(1, 0, 0)]
    }

    def Mesh "hidden"
    {
        token visibility = "invisible"
        int[] faceVertexCounts = [3]
        int[] faceVertexIndices = [0, 1, 2]
        point3f[] points = [(0, 0, 0), (1, 0, 0), (0, 1, 0)]
    }

    def Scope "collisions"
    {
        uniform token purpose = "guide"

        def Mesh "box"
        {
            int[] faceVertexCounts = [4]
            int[] faceVertexIndices = [0, 1, 2, 3]
            point3f[] points = [(0, 0, 0), (9, 0, 0), (9, 9, 0), (0, 9, 0)]
        }
    }
}
"""

EMPTY_USDA = """#usda 1.0

def Xform "Robot"
{
}
"""


def _write(root: Path, asset_id: str, text: str) -> Path:
    p = root / asset_id / f"{asset_id}.usda"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text)
    return p


def _parse(glb: bytes) -> tuple[dict, bytes]:
    magic, version, length = struct.unpack("<III", glb[:12])
    assert (magic, version, length) == (0x46546C67, 2, len(glb))
    json_len, kind = struct.unpack("<II", glb[12:20])
    assert kind == 0x4E4F534A
    gltf = json.loads(glb[20 : 20 + json_len])
    bin_start = 20 + json_len + 8
    return gltf, glb[bin_start:]


def _cache_files() -> list[Path]:
    return sorted((config.data_dir / "cache" / "sim-models").glob("*.glb"))


def test_robot_model(client):
    _write(config.sim_robots_dir, "cube_bot", CUBE_USDA)
    r = client.get("/sim/robots/cube_bot/model.glb")
    assert r.status_code == 200
    assert r.headers["content-type"] == "model/gltf-binary"
    gltf, blob = _parse(r.content)

    assert len(gltf["meshes"]) == 1  # one colour: the cube; hidden and guide meshes are skipped
    assert gltf["materials"][0]["pbrMetallicRoughness"]["baseColorFactor"] == [1, 0, 0, 1]
    pos, idx = gltf["accessors"]
    assert pos["count"] == 8 and idx["count"] == 6 * 2 * 3
    # 1 cm cube lifted 5 cm, Z up → Y up
    assert np.allclose(pos["min"], [0, 0.05, -0.01]) and np.allclose(pos["max"], [0.01, 0.06, 0])
    view = gltf["bufferViews"][idx["bufferView"]]
    tris = np.frombuffer(blob, np.uint32, idx["count"], view["byteOffset"])
    assert tris.max() == 7


def test_tool_model_and_unknown_ids(client):
    _write(config.sim_tools_dir, "cube_hand", CUBE_USDA)
    assert client.get("/sim/tools/cube_hand/model.glb").status_code == 200
    assert client.get("/sim/tools/nope/model.glb").status_code == 404
    assert client.get("/sim/robots/cube_hand/model.glb").status_code == 404


def test_no_visible_mesh_is_422(client):
    _write(config.sim_robots_dir, "empty", EMPTY_USDA)
    r = client.get("/sim/robots/empty/model.glb")
    assert r.status_code == 422
    assert "no visible mesh" in r.json()["error"]["message"]

    _write(config.sim_robots_dir, "broken", "#usda 1.0\ndef Xform {\n")
    r = client.get("/sim/robots/broken/model.glb")
    assert r.status_code == 422
    assert r.json()["error"]["message"].startswith("Cannot convert broken.usda")


def test_cached_until_the_usd_changes(client):
    usd = _write(config.sim_robots_dir, "cached_bot", CUBE_USDA)
    first = client.get("/sim/robots/cached_bot/model.glb").content
    (cached,) = [p for p in _cache_files() if p.name.startswith("robot-cached_bot-")]
    mtime = cached.stat().st_mtime_ns
    assert client.get("/sim/robots/cached_bot/model.glb").content == first
    assert cached.stat().st_mtime_ns == mtime  # served from the cache, not rebuilt

    usd.write_text(CUBE_USDA.replace("(1, 0, 0)]", "(0, 0, 1)]"))
    os.utime(usd, ns=(mtime + 10**9, mtime + 10**9))
    gltf, _ = _parse(client.get("/sim/robots/cached_bot/model.glb").content)
    assert gltf["materials"][0]["pbrMetallicRoughness"]["baseColorFactor"] == [0, 0, 1, 1]
    remaining = [p for p in _cache_files() if p.name.startswith("robot-cached_bot-")]
    assert remaining and cached not in remaining  # the stale file is replaced

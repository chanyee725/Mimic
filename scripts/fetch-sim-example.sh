#!/usr/bin/env bash
# Download the SO-101 lift-cube example environment into the Isaac Sim environments folder.
# Assets: LeIsaac releases (LightwheelAI, Apache-2.0) — robot USD + table-with-cube scene;
# the stage that places them is sim/examples/so101_lift_cube/scene.usda.
#
#   scripts/fetch-sim-example.sh            into sim/envs/so101-kit/so101_lift_cube
#   scripts/fetch-sim-example.sh --force    replace an existing copy
#   VLA_SIM_ENVS_DIR=/path scripts/...      another environments folder
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENVS="${VLA_SIM_ENVS_DIR:-sim/envs}"
case "$ENVS" in /*) ;; *) ENVS="$ROOT/$ENVS" ;; esac
DEST="$ENVS/so101-kit/so101_lift_cube"
EXAMPLE="$ROOT/sim/examples/so101_lift_cube"
BASE="https://github.com/LightwheelAI/leisaac/releases/download"
ROBOT_URL="$BASE/v0.1.0/so101_follower.usd"
ROBOT_SHA="64a877c3b82cdc4a48ab8a1f321a2dd3ef7c55d4b10bce222b58c530d978ae58"
SCENE_URL="$BASE/v0.1.2/table_with_cube.zip"
SCENE_SHA="917c66a724019d235cc9f442a30ae72e5663b44ef4ed8d4d5324e549e11952b7"

FORCE=0
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    -h | --help) sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done
if [ -e "$DEST" ] && [ "$FORCE" = 0 ]; then
  echo "$DEST already exists (use --force to replace it)" >&2
  exit 1
fi
for tool in curl sha256sum python3; do
  command -v "$tool" >/dev/null || { echo "$tool not found" >&2; exit 1; }
done

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fetch() { # url sha out
  echo "downloading $1"
  curl -fsSL --retry 3 -o "$3" "$1"
  echo "$2  $3" | sha256sum -c --quiet - || { echo "checksum mismatch: $1" >&2; exit 1; }
}
fetch "$ROBOT_URL" "$ROBOT_SHA" "$TMP/so101_follower.usd"
fetch "$SCENE_URL" "$SCENE_SHA" "$TMP/table_with_cube.zip"

STAGE="$TMP/so101_lift_cube"
mkdir -p "$STAGE/robot"
python3 -I -m zipfile -e "$TMP/table_with_cube.zip" "$STAGE"
mv "$TMP/so101_follower.usd" "$STAGE/robot/"
cp "$EXAMPLE/scene.usda" "$EXAMPLE/README.md" "$STAGE/"
cp "$STAGE/table_with_cube/.thumbs/256x256/scene.usd.png" "$STAGE/thumbnail.png"

mkdir -p "$(dirname "$DEST")"
rm -rf "$DEST"
mv "$STAGE" "$DEST"
echo "ready: $DEST — Rescan on the Environments page"

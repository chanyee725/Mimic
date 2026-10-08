#!/usr/bin/env bash
# Download the SO-101 follower robot USD into the sim folder's robots/ (data/sims/robots/).
# Source: the so101_follower.usd LightwheelAI publishes (Apache-2.0), checked by SHA-256.
#
#   scripts/fetch-sim-robot.sh            into data/sims/robots/so101_follower.usd
#   scripts/fetch-sim-robot.sh --force    replace an existing copy
#   VLA_SIM_DIR=/path scripts/...         another sim folder
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SIMS="${VLA_SIM_DIR:-${VLA_DATA_DIR:-data}/sims}"
case "$SIMS" in /*) ;; *) SIMS="$ROOT/$SIMS" ;; esac
DEST="$SIMS/robots/so101_follower.usd"
URL="https://github.com/LightwheelAI/leisaac/releases/download/v0.1.0/so101_follower.usd"
SHA="64a877c3b82cdc4a48ab8a1f321a2dd3ef7c55d4b10bce222b58c530d978ae58"

FORCE=0
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    -h | --help) sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done
if [ -e "$DEST" ] && [ "$FORCE" = 0 ]; then
  echo "$DEST already exists (use --force to replace it)" >&2
  exit 1
fi
for tool in curl sha256sum; do
  command -v "$tool" >/dev/null || { echo "$tool not found" >&2; exit 1; }
done

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
echo "downloading $URL"
curl -fsSL --retry 3 -o "$TMP/robot.usd" "$URL"
echo "$SHA  $TMP/robot.usd" | sha256sum -c --quiet - || { echo "checksum mismatch: $URL" >&2; exit 1; }
mkdir -p "$(dirname "$DEST")"
mv "$TMP/robot.usd" "$DEST"
echo "ready: $DEST — tag environments with so101_follower on the Environments page"

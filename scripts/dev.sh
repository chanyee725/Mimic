#!/usr/bin/env bash
# Run the backend (FastAPI, :8000) and the web dev server (Vite, :5173) together.
# Ctrl+C stops both; if one exits, the other is stopped too.
#
#   scripts/dev.sh             start both
#   scripts/dev.sh --install   run `uv sync` and `npm install` first
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL=0
for arg in "$@"; do
  case "$arg" in
    --install) INSTALL=1 ;;
    -h | --help) sed -n '2,7p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

# Node from web/.nvmrc via nvm when available
if [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  nvm use --silent "$(cat "$ROOT/web/.nvmrc")" >/dev/null 2>&1 ||
    echo "nvm: Node $(cat "$ROOT/web/.nvmrc") not installed, using $(node -v 2>/dev/null || echo none)" >&2
fi
command -v uv >/dev/null || { echo "uv not found" >&2; exit 1; }
command -v npm >/dev/null || { echo "npm not found" >&2; exit 1; }

if [ "$INSTALL" = 1 ] || [ ! -d "$ROOT/backend/.venv" ]; then
  (cd "$ROOT/backend" && uv sync)
fi
if [ "$INSTALL" = 1 ] || [ ! -d "$ROOT/web/node_modules" ]; then
  (cd "$ROOT/web" && npm install)
fi

# Stop every child (uvicorn reloader, vite, sed) on exit
trap 'trap - INT TERM EXIT; kill 0 2>/dev/null; wait 2>/dev/null' INT TERM EXIT

prefix() { sed -u "s/^/$(printf '\033[%sm[%s]\033[0m' "$1" "$2") /"; }

(cd "$ROOT/backend" && exec uv run uvicorn app.main:app --reload) 2>&1 | prefix 36 api &
(cd "$ROOT/web" && exec npm run dev) 2>&1 | prefix 35 web &

echo "api  http://localhost:8000/api/v1/docs"
echo "web  http://localhost:5173"
wait -n

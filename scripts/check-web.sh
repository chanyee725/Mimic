#!/usr/bin/env bash
# Claude Code PostToolUse hook (Bash): after a test run or a branch change, clear the Vite module
# cache (touch web/src so the dev server rebuilds every module) and check that every page renders
# (scripts/check-web.py). Exit 2 sends the failure back to Claude. Skipped when the dev server is
# not running on :5173.
#
#   scripts/check-web.sh           read the hook JSON on stdin (runs only for matching commands)
#   scripts/check-web.sh --force   run now
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
URL="${VITE_CHECK_URL:-http://localhost:5173}"

if [ "${1:-}" != "--force" ]; then
  cmd="$(jq -r '.tool_input.command // ""' 2>/dev/null)"
  # Tests, checks, and git commands that swap files under the dev server
  pattern='pytest|npm (run )?(check|test)|vitest|git (switch|checkout|merge|rebase|reset|stash|pull|cherry-pick)'
  echo "$cmd" | grep -Eq "$pattern" || exit 0
fi

curl -fs -o /dev/null --max-time 2 "$URL/" || { echo "Web check skipped: no dev server at $URL"; exit 0; }

find "$ROOT/web/src" -type f -exec touch {} +
sleep 2

if ! out="$(uv run -q --no-project --with playwright python -I "$ROOT/scripts/check-web.py" "$URL" 2>&1)"; then
  echo "$out" >&2
  echo "Fix the pages (or restart the Vite dev server if modules are stale) before reporting." >&2
  exit 2
fi
echo "$out"

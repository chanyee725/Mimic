"""Opens every web page in headless Chrome and fails when one renders blank or logs an error.

Run by scripts/check-web.sh (a Claude Code hook) after tests and branch switches, once the Vite
module cache is cleared. Pages come from web/src/app/nav.ts (plus the Environments tabs).

  uv run --no-project --with playwright python -I scripts/check-web.py [base-url]
"""

import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5173"
EXTRA = ["/environments?view=robots", "/environments?view=tools"]


def pages() -> list[str]:
    nav = (ROOT / "web" / "src" / "app" / "nav.ts").read_text()
    return re.findall(r'to: "(/[^"]*)"', nav) + EXTRA


def main() -> int:
    problems: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        errors: list[str] = []
        page.on("console", lambda m: m.type == "error" and errors.append(m.text))
        page.on("pageerror", lambda e: errors.append(str(e)))
        for path in pages():
            errors.clear()
            page.goto(BASE + path, wait_until="networkidle")
            page.wait_for_timeout(500)
            if not page.inner_text("body").strip():
                problems.append(f"{path}: blank page")
            problems += [f"{path}: {e}" for e in errors]
        browser.close()
    if problems:
        print("Web check failed:\n" + "\n".join(f"  {p}" for p in problems), file=sys.stderr)
        return 1
    print(f"Web check passed: {len(pages())} pages render with no console errors")
    return 0


if __name__ == "__main__":
    sys.exit(main())

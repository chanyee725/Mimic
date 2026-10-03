"""Success check for sort-by-color: every block in the tray of its colour."""


def check(state: dict) -> tuple[bool, bool, str | None]:
    """Return (done, success, failure_reason)."""
    if state.get("goal_reached"):
        return True, True, None
    if state.get("wrong_tray"):
        return True, False, "Wrong tray"
    if state.get("elapsed_s", 0) >= state.get("max_seconds", 40):
        return True, False, "Timed out"
    return False, False, None

"""Success check for open-drawer: drawer pulled out at least 10 cm."""


def check(state: dict) -> tuple[bool, bool, str | None]:
    """Return (done, success, failure_reason)."""
    if state.get("goal_reached"):
        return True, True, None
    if state.get("lost_the_handle"):
        return True, False, "Lost the handle"
    if state.get("elapsed_s", 0) >= state.get("max_seconds", 40):
        return True, False, "Timed out"
    return False, False, None

"""Success check for pick-red-cube: red cube inside the bowl."""


def check(state: dict) -> tuple[bool, bool, str | None]:
    """Return (done, success, failure_reason)."""
    if state.get("goal_reached"):
        return True, True, None
    if state.get("dropped_object"):
        return True, False, "Dropped object"
    if state.get("missed_the_bowl"):
        return True, False, "Missed the bowl"
    if state.get("elapsed_s", 0) >= state.get("max_seconds", 40):
        return True, False, "Timed out"
    return False, False, None

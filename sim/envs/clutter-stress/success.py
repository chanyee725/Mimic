"""Success check for clutter-stress: target object lifted 5 cm."""


def check(state: dict) -> tuple[bool, bool, str | None]:
    """Return (done, success, failure_reason)."""
    if state.get("goal_reached"):
        return True, True, None
    if state.get("grasped_a_distractor"):
        return True, False, "Grasped a distractor"
    if state.get("elapsed_s", 0) >= state.get("max_seconds", 40):
        return True, False, "Timed out"
    return False, False, None

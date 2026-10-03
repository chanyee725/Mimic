"""Sessions derived from recordings: one per task and station day (no stored sessions)."""

from collections import defaultdict

from app.models.recordings import Recording
from app.models.tasks import Session
from app.utils.time import parse_iso, tz


def _day(rec: Recording) -> str:
    return parse_iso(rec.recorded_at).astimezone(tz()).date().isoformat()


def _pct(n: int, total: int) -> float:
    return round(100 * n / total, 1) if total else 0.0


def from_recordings(recs: list[Recording]) -> list[Session]:
    groups: dict[tuple[str, str], list[Recording]] = defaultdict(list)
    for r in recs:
        if r.task_id:
            groups[(r.task_id, _day(r))].append(r)
    out = []
    for (task_id, day), rows in groups.items():
        n = len(rows)
        out.append(
            Session(
                id=f"{task_id}-{day}",
                task_id=task_id,
                operator=None,  # recordings do not carry the operator yet
                episodes=n,
                accepted=sum(r.review == "accepted" for r in rows),
                success_pct=_pct(sum(r.outcome == "success" for r in rows), n),
                fail_pct=_pct(sum(r.outcome == "fail" for r in rows), n),
                status="review" if any(r.review == "pending" for r in rows) else "reviewed",
                date=day,
            )
        )
    return sorted(out, key=lambda s: (s.date, s.id), reverse=True)

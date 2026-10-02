import { useState } from "react"
import { LuCheck, LuX } from "react-icons/lu"

import { StatusDot, type Tone } from "@/components/app/status-dot"
import { Button } from "@/components/ui/button"
import type { Outcome } from "@/dummy/tasks"
import { cn } from "@/lib/utils"
import { checksOf, type CapturedEpisode, type Review } from "../episode-review"

const OUTCOME_TONE: Record<Outcome, Tone> = { success: "ok", fail: "bad", partial: "warn" }
const REVIEW_CLASS: Record<Review, string> = {
  pending: "text-muted-foreground",
  accepted: "text-ok",
  rejected: "text-bad",
}

/** 저장된 에피소드 검수: 자동 검증 결과를 보고 Accept / Reject */
export function EpisodeList({
  episodes,
  videoFps,
  onReview,
}: {
  episodes: CapturedEpisode[]
  videoFps: number
  onReview: (index: number, review: Review) => void
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(episodes[0]?.index ?? null)

  if (episodes.length === 0) {
    return <p className="py-4 text-center text-[13px] text-muted-foreground">저장된 에피소드가 없습니다.</p>
  }

  return (
    <ul className="-mx-2 grid gap-0.5">
      {episodes.map((e) => {
        const checks = checksOf(e, videoFps)
        const issues = checks.filter((c) => !c.ok).length
        const open = openIndex === e.index
        return (
          <li key={e.index} className={cn("rounded-md", open && "bg-accent/60")}>
            <div className="flex items-center gap-3 px-2 py-1.5">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenIndex(open ? null : e.index)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left text-[13px]"
              >
                <span className="w-8 shrink-0 text-muted-foreground tabular-nums">#{e.index}</span>
                <span className="w-12 shrink-0 tabular-nums">{e.lengthS.toFixed(1)}s</span>
                <StatusDot tone={OUTCOME_TONE[e.outcome]} className="w-20 shrink-0 text-[13px]">
                  {e.outcome}
                </StatusDot>
                <span className={cn("truncate text-xs", issues ? "text-warn" : "text-muted-foreground")}>
                  {issues ? `${issues} issue${issues > 1 ? "s" : ""}` : "valid"}
                </span>
              </button>
              <span className={cn("w-16 shrink-0 text-right text-xs", REVIEW_CLASS[e.review])}>{e.review}</span>
              <div className="flex shrink-0 gap-0.5">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Accept episode ${e.index}`}
                  title="Accept"
                  className={cn("text-muted-foreground", e.review === "accepted" && "text-ok")}
                  onClick={() => onReview(e.index, "accepted")}
                >
                  <LuCheck />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Reject episode ${e.index}`}
                  title="Reject"
                  className={cn("text-muted-foreground", e.review === "rejected" && "text-bad")}
                  onClick={() => onReview(e.index, "rejected")}
                >
                  <LuX />
                </Button>
              </div>
            </div>
            {open && (
              <dl className="grid gap-1 px-2 pb-2.5 pl-13">
                {checks.map((c) => (
                  <div key={c.label} className="flex justify-between gap-3 text-xs">
                    <dt>
                      <StatusDot tone={c.ok ? "ok" : "bad"} className="text-xs text-muted-foreground">
                        {c.label}
                      </StatusDot>
                    </dt>
                    <dd className={cn("tabular-nums", c.ok ? "text-muted-foreground" : "text-bad")}>{c.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        )
      })}
    </ul>
  )
}

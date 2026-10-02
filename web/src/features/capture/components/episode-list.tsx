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

/** 저장된 에피소드 검수: 좁은 오른쪽 열에 맞춘 2줄 행. 자동 검증 결과를 보고 Accept / Reject */
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
    <ul className="-mx-2 grid min-h-0 flex-1 content-start gap-0.5 overflow-x-hidden overflow-y-auto">
      {episodes.map((e) => {
        const checks = checksOf(e, videoFps)
        const issues = checks.filter((c) => !c.ok).length
        const open = openIndex === e.index
        return (
          <li key={e.index} className={cn("rounded-md transition-colors", open ? "bg-accent/60" : "hover:bg-accent/60")}>
            <div className="flex items-center gap-1 py-1.5 pr-1 pl-2">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenIndex(open ? null : e.index)}
                className="grid min-w-0 flex-1 gap-0.5 text-left"
              >
                <span className="flex min-w-0 items-center gap-2 text-[13px]">
                  <span className="font-medium tabular-nums">#{e.index}</span>
                  <span className="ml-auto shrink-0 text-muted-foreground tabular-nums">{e.lengthS.toFixed(1)}s</span>
                </span>
                <span className="truncate text-[11px]">
                  {/* 좁은 열에서 잘리지 않도록 결과는 둘째 줄에 */}
                  <StatusDot tone={OUTCOME_TONE[e.outcome]} className="text-[11px] text-foreground">
                    {e.outcome}
                  </StatusDot>
                  <span className="text-muted-foreground"> · </span>
                  <span className={issues ? "text-warn" : "text-muted-foreground"}>
                    {issues ? `${issues} issue${issues > 1 ? "s" : ""}` : "valid"}
                  </span>
                  <span className="text-muted-foreground"> · </span>
                  <span className={REVIEW_CLASS[e.review]}>{e.review}</span>
                </span>
              </button>
              <div className="flex shrink-0">
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
              <dl className="grid gap-0.5 px-2 pb-2">
                {checks.map((c) => (
                  <div key={c.label} className="flex min-w-0 justify-between gap-2 text-[11px]">
                    <dt className="min-w-0 truncate">
                      <StatusDot tone={c.ok ? "ok" : "bad"} className="text-[11px] text-muted-foreground">
                        {c.label}
                      </StatusDot>
                    </dt>
                    <dd className={cn("shrink-0 tabular-nums", c.ok ? "text-muted-foreground" : "text-bad")}>{c.value}</dd>
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

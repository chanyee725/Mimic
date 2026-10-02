import { useState } from "react"
import { LuChevronLeft, LuChevronRight } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StatusDot } from "@/components/app/status-dot"
import type { Recording } from "@/dummy/recordings"
import { plural } from "@/lib/format"
import { cn } from "@/lib/utils"

import { FILTERS, latestFirst, OUTCOME_TONE, PAGE_SIZE, REVIEW_CLASS, shortName, type ReviewFilter } from "../lib"

/** 선택한 Task 의 에피소드 목록. 검수 상태로 거르고 10 개씩 넘겨 본다 */
export function EpisodeList({
  recordings,
  selectedId,
  onSelect,
  className,
}: {
  recordings: Recording[]
  selectedId: string | null
  onSelect: (id: string) => void
  className?: string
}) {
  const [filter, setFilter] = useState<ReviewFilter>("all")
  const [page, setPage] = useState(0)

  const count = (f: ReviewFilter) => (f === "all" ? recordings.length : recordings.filter((r) => r.review === f).length)
  // 최근 에피소드가 위로
  const visible = latestFirst(recordings.filter((r) => filter === "all" || r.review === filter))
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const rows = visible.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)

  return (
    <div className={cn("@container flex min-h-0 flex-col gap-2", className)}>
      <Tabs
        value={filter}
        onValueChange={(v) => {
          setFilter(v as ReviewFilter)
          setPage(0)
        }}
      >
        <TabsList className="grid w-full grid-cols-4">
          {FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value} className="min-w-0 gap-1 px-1 text-xs">
              <span className="truncate">{f.label}</span>
              {/* 좁은 패널에서는 개수를 숨겨 라벨이 겹치지 않게 한다 */}
              <span className="hidden text-muted-foreground tabular-nums @[19rem]:inline">{count(f.value)}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <ul className="-mx-2 grid min-h-0 flex-1 content-start gap-0.5 overflow-y-auto">
        {rows.map((r) => {
          const selected = r.id === selectedId
          const issues = r.checks.filter((c) => !c.ok).length
          return (
            <li key={r.id}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(r.id)}
                className={cn(
                  "grid w-full gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent/60",
                  selected && "bg-accent hover:bg-accent",
                )}
              >
                <span className="flex min-w-0 items-center gap-2 text-[13px]">
                  <span className={cn("truncate", selected ? "font-medium" : "font-normal")}>{shortName(r.file)}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">{r.durationS.toFixed(1)}s</span>
                </span>
                <span className="flex min-w-0 items-center gap-2.5 truncate text-[11px] whitespace-nowrap">
                  {r.outcome ? (
                    <StatusDot tone={OUTCOME_TONE[r.outcome]} className="text-[11px]">
                      {r.outcome}
                    </StatusDot>
                  ) : (
                    <span className="text-muted-foreground">no label</span>
                  )}
                  <span className={REVIEW_CLASS[r.review]}>{r.review}</span>
                  <span className={issues ? "text-warn" : "text-muted-foreground"}>{issues ? plural(issues, "issue") : "valid"}</span>
                </span>
              </button>
            </li>
          )
        })}
        {rows.length === 0 && <li className="py-6 text-center text-[13px] text-muted-foreground">해당하는 에피소드가 없습니다.</li>}
      </ul>

      {pages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
          <span>
            {current * PAGE_SIZE + 1}–{Math.min(visible.length, (current + 1) * PAGE_SIZE)} of {visible.length}
          </span>
          <span className="flex gap-0.5">
            <Button variant="ghost" size="icon-sm" aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)}>
              <LuChevronLeft />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Next page"
              disabled={current >= pages - 1}
              onClick={() => setPage(current + 1)}
            >
              <LuChevronRight />
            </Button>
          </span>
        </div>
      )}
    </div>
  )
}

import { useState } from "react"
import { LuSearch } from "react-icons/lu"

import { StatusDot, type Tone } from "@/components/app/status-dot"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Recording, RecordingReview } from "@/dummy/recordings"
import type { Outcome } from "@/dummy/tasks"
import { cn } from "@/lib/utils"

type ReviewFilter = "all" | RecordingReview
type SourceFilter = "all" | Recording["source"]

const REVIEW_FILTERS: { value: ReviewFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
]

const SOURCE_FILTERS: { value: SourceFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "capture", label: "Captured" },
  { value: "external", label: "Imported" },
]

const OUTCOME_TONE: Record<Outcome, Tone> = { success: "ok", fail: "bad", partial: "warn" }
const REVIEW_CLASS: Record<RecordingReview, string> = {
  pending: "text-muted-foreground",
  accepted: "text-ok",
  rejected: "text-bad",
}

/** `stack-two-blocks/ep_0047.mcap` → `ep_0047` */
const shortName = (file: string) => file.split("/").pop()!.replace(/\.mcap$/, "")

/** Task 별로 묶고, 외부에서 가져온 파일은 "Imported" 아래로 */
function groupOf(r: Recording) {
  return r.source === "external" ? "Imported" : (r.taskId ?? "Unassigned")
}

/** 저장된 MCAP 목록: 검수 상태 · 출처 필터와 검색 */
export function RecordingList({
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
  const [query, setQuery] = useState("")
  const [review, setReview] = useState<ReviewFilter>("all")
  const [source, setSource] = useState<SourceFilter>("all")

  const q = query.trim().toLowerCase()
  const bySourceAndQuery = recordings.filter(
    (r) =>
      (source === "all" || r.source === source) &&
      (!q || r.file.toLowerCase().includes(q) || (r.taskId ?? "").includes(q)),
  )
  const visible = bySourceAndQuery.filter((r) => review === "all" || r.review === review)
  const countOf = (f: ReviewFilter) => bySourceAndQuery.filter((r) => f === "all" || r.review === f).length

  const groups = visible.reduce<Map<string, Recording[]>>((m, r) => {
    const g = groupOf(r)
    m.set(g, [...(m.get(g) ?? []), r])
    return m
  }, new Map())
  // Imported 그룹은 항상 맨 아래
  const groupNames = [...groups.keys()].sort((a, b) => Number(a === "Imported") - Number(b === "Imported"))

  return (
    <div className={cn("flex min-h-0 min-w-0 flex-col gap-2", className)}>
      <div className="relative">
        <LuSearch className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label="Search recordings"
          placeholder="Search file or task…"
          className="h-8 border-transparent bg-muted/60 pl-8 text-[13px] shadow-none focus-visible:bg-background"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <Tabs value={review} onValueChange={(v) => setReview(v as ReviewFilter)}>
        <TabsList className="w-full">
          {REVIEW_FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value} className="min-w-0 flex-1 gap-1 px-1.5 text-xs">
              {f.label}
              <span className="text-muted-foreground tabular-nums">{countOf(f.value)}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div role="group" aria-label="Source" className="flex items-center gap-1 text-xs">
        <span className="mr-1 text-muted-foreground">Source</span>
        {SOURCE_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={source === f.value}
            onClick={() => setSource(f.value)}
            className={cn(
              "h-6 rounded-md px-2 transition-colors hover:bg-accent/60",
              source === f.value ? "bg-accent font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        {groupNames.length === 0 && (
          <p className="py-6 text-center text-[13px] text-muted-foreground">조건에 맞는 녹화 파일이 없습니다.</p>
        )}
        {groupNames.map((g) => (
          <section key={g} className="grid gap-0.5 pb-2">
            <h3 className="flex items-baseline gap-1.5 px-2 pt-1 text-xs text-muted-foreground">
              <span className="truncate">{g}</span>
              <span className="tabular-nums">{groups.get(g)!.length}</span>
            </h3>
            <ul className="grid gap-0.5">
              {groups.get(g)!.map((r) => {
                const selected = r.id === selectedId
                const issues = r.checks.filter((c) => !c.ok).length
                return (
                  <li key={r.id}>
                    <div
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent/60",
                        selected && "bg-accent hover:bg-accent",
                      )}
                    >
                      <button
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onSelect(r.id)}
                        className="grid min-w-0 flex-1 gap-0.5 text-left"
                      >
                        <span className="flex min-w-0 items-center gap-2 text-[13px]">
                          <span className={cn("truncate", selected ? "font-medium" : "font-normal")}>
                            {shortName(r.file)}
                          </span>
                          <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
                            {r.durationS.toFixed(1)}s
                          </span>
                        </span>
                        <span className="flex min-w-0 items-center gap-1.5 truncate text-[11px] whitespace-nowrap">
                          {r.outcome ? (
                            <StatusDot tone={OUTCOME_TONE[r.outcome]} className="text-[11px]">
                              {r.outcome}
                            </StatusDot>
                          ) : (
                            <span className="text-muted-foreground">no label</span>
                          )}
                          <span className="text-muted-foreground">·</span>
                          <span className={REVIEW_CLASS[r.review]}>{r.review}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className={issues ? "text-warn" : "text-muted-foreground"}>
                            {issues ? `${issues} issue${issues > 1 ? "s" : ""}` : "valid"}
                          </span>
                        </span>
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>

    </div>
  )
}

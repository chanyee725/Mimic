import { useState } from "react"
import { LuChevronLeft, LuChevronRight } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StatusDot } from "@/components/common/status-dot"
import type { Recording } from "@/domain/recording"
import { plural } from "@/lib/format"
import { cn } from "@/lib/utils"

import { FILTERS, OUTCOME_TONE, PAGE_SIZE, REVIEW_CLASS, shortName, type ReviewFilter } from "../lib"
import { QueryNote } from "./query-note"

/** What the list needs from the paged recordings query */
export type RecordingPages = {
  isPending: boolean
  error: Error | null
  refetch: () => unknown
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => Promise<unknown>
}

/**
 * Episode list for the selected task, filtered by review status on the server and shown 10 at a time.
 * Stepping past the loaded rows fetches the next server page.
 */
export function EpisodeList({
  recordings,
  total,
  query,
  filter,
  onFilterChange,
  selectedId,
  onSelect,
  className,
}: {
  recordings: Recording[]
  /** Rows matching the filter on the server */
  total: number
  query: RecordingPages
  filter: ReviewFilter
  onFilterChange: (f: ReviewFilter) => void
  selectedId: string | null
  onSelect: (id: string) => void
  className?: string
}) {
  const [page, setPage] = useState(0)

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const rows = recordings.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)
  const next = async () => {
    // The next 10 rows may not be loaded yet
    if ((current + 1) * PAGE_SIZE >= recordings.length && query.hasNextPage) await query.fetchNextPage()
    setPage(current + 1)
  }

  return (
    <div className={cn("@container flex min-h-0 flex-col gap-2", className)}>
      <Tabs
        value={filter}
        onValueChange={(v) => {
          onFilterChange(v as ReviewFilter)
          setPage(0)
        }}
      >
        <TabsList className="grid w-full grid-cols-4">
          {FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value} className="min-w-0 gap-1 px-1 text-xs">
              <span className="truncate">{f.label}</span>
              {/* Only the active filter's count is known; hidden in narrow panels so labels do not overlap */}
              {f.value === filter && !query.isPending && (
                <span className="hidden text-muted-foreground tabular-nums @[19rem]:inline">{total.toLocaleString()}</span>
              )}
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
        {(query.isPending || query.error) && (
          <li className="px-2 py-6 text-center">
            <QueryNote query={query} />
          </li>
        )}
        {!query.isPending && !query.error && rows.length === 0 && (
          <li className="py-6 text-center text-[13px] text-muted-foreground">
            {query.isFetchingNextPage ? "Loading…" : "해당하는 에피소드가 없습니다."}
          </li>
        )}
      </ul>

      {pages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
          <span>
            {(current * PAGE_SIZE + 1).toLocaleString()}–{Math.min(total, (current + 1) * PAGE_SIZE).toLocaleString()} of{" "}
            {total.toLocaleString()}
          </span>
          <span className="flex gap-0.5">
            <Button variant="ghost" size="icon-sm" aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)}>
              <LuChevronLeft />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Next page"
              disabled={current >= pages - 1 || query.isFetchingNextPage}
              onClick={() => void next()}
            >
              <LuChevronRight />
            </Button>
          </span>
        </div>
      )}
    </div>
  )
}

import { useState } from "react"
import { LuChevronLeft, LuChevronRight } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StatusDot } from "@/components/common/status-dot"
import { WorldMark } from "@/components/robot/world-mark"
import type { Recording } from "@/domain/recording"
import { plural } from "@/lib/format"
import { cn } from "@/lib/utils"

import { FILTERS, OUTCOME_TONE, PAGE_SIZE, REVIEW_CLASS, shortName, type ReviewFilter } from "../lib"
import { QueryNote } from "@/components/common/query-state"

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
 * Stepping past the loaded rows fetches the next server page. Row checkboxes pick episodes for the bulk actions;
 * shift-click picks a range, the header checkbox the current page.
 */
export function EpisodeList({
  recordings,
  total,
  query,
  filter,
  onFilterChange,
  selectedId,
  onSelect,
  checked,
  onCheck,
  onCheckAll,
  checkingAll,
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
  /** Ids picked for the bulk actions */
  checked: ReadonlySet<string>
  onCheck: (ids: string[], on: boolean) => void
  /** Picks every episode matching the filter (loads the remaining pages) */
  onCheckAll: () => void
  checkingAll: boolean
  className?: string
}) {
  const [page, setPage] = useState(0)
  const [anchor, setAnchor] = useState<number | null>(null)

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const rows = recordings.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)
  const next = async () => {
    // The next 10 rows may not be loaded yet
    if ((current + 1) * PAGE_SIZE >= recordings.length && query.hasNextPage) await query.fetchNextPage()
    setPage(current + 1)
  }

  const pageIds = rows.map((r) => r.id)
  const pageChecked = pageIds.filter((id) => checked.has(id)).length
  const toggle = (index: number, on: boolean, shift: boolean) => {
    const from = shift && anchor !== null ? Math.min(anchor, index) : index
    const to = shift && anchor !== null ? Math.max(anchor, index) : index
    onCheck(
      recordings.slice(from, to + 1).map((r) => r.id),
      on,
    )
    setAnchor(index)
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

      <div className="flex h-7 items-center gap-2.5 text-xs text-muted-foreground">
        <Checkbox
          aria-label="Select page"
          disabled={rows.length === 0}
          checked={rows.length > 0 && pageChecked === rows.length}
          indeterminate={pageChecked > 0 && pageChecked < rows.length}
          onCheckedChange={(on) => onCheck(pageIds, on)}
        />
        <span className="tabular-nums">{checked.size ? `${checked.size.toLocaleString()} selected` : "Select"}</span>
        {checked.size > 0 && checked.size < total && (
          <Button variant="ghost" size="xs" className="ml-auto" disabled={checkingAll} onClick={onCheckAll}>
            {checkingAll ? "Loading…" : `Select all ${total.toLocaleString()}`}
          </Button>
        )}
        {checked.size > 0 && (
          <Button variant="ghost" size="xs" className={cn(checked.size >= total && "ml-auto")} onClick={() => onCheck([...checked], false)}>
            Clear
          </Button>
        )}
      </div>

      <ul className="-mx-2 grid select-none min-h-0 flex-1 content-start gap-0.5 overflow-y-auto">
        {rows.map((r, i) => {
          const selected = r.id === selectedId
          const issues = r.checks.filter((c) => !c.ok).length
          const index = current * PAGE_SIZE + i
          return (
            <li
              key={r.id}
              className={cn(
                "flex items-center gap-2.5 rounded-md pl-2 transition-colors hover:bg-accent/60",
                selected && "bg-accent hover:bg-accent",
              )}
            >
              <Checkbox
                aria-label={`Select ${shortName(r.file)}`}
                checked={checked.has(r.id)}
                onCheckedChange={(on, details) => toggle(index, on, (details.event as MouseEvent).shiftKey)}
              />
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(r.id)}
                className="grid min-w-0 flex-1 gap-0.5 py-1.5 pr-2 text-left"
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
                  {r.simEnv && <WorldMark world="sim" label />}
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

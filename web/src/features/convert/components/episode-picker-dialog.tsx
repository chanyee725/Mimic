import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import type { Recording } from "@/domain/recording"

import { PICKER_PAGE } from "../lib"
import { QueryNote } from "@/components/common/query-state"

/** What the dialog needs from the paged accepted-recordings query */
export type AcceptedPages = {
  isPending: boolean
  error: Error | null
  refetch: () => unknown
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => Promise<unknown>
}

/** Dialog for excluding accepted episodes from conversion. The parent keys it by task to reset the page */
export function EpisodePickerDialog({
  open,
  onOpenChange,
  taskId,
  accepted,
  total,
  query,
  excluded,
  onExcludedChange,
  onExcludeAll,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskId?: string
  /** Loaded accepted recordings (server pages) */
  accepted: Recording[]
  /** All accepted recordings of the task */
  total: number
  query: AcceptedPages
  excluded: string[]
  onExcludedChange: (update: (ids: string[]) => string[]) => void
  /** Excludes every accepted recording, loading the remaining pages first */
  onExcludeAll: () => void
}) {
  const [page, setPage] = useState(0)
  const skip = new Set(excluded)
  const selected = total - excluded.length
  const pages = Math.ceil(total / PICKER_PAGE)
  const next = async () => {
    if ((page + 1) * PICKER_PAGE >= accepted.length && query.hasNextPage) await query.fetchNextPage()
    setPage((n) => n + 1)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-3 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose episodes</DialogTitle>
          <DialogDescription>{taskId} 의 승인된 에피소드 중 변환할 것을 고릅니다. 기본은 전부 선택입니다.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
          <span>
            {selected.toLocaleString()} of {total.toLocaleString()} selected
          </span>
          <span className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-7" onClick={() => onExcludedChange(() => [])}>
              Select all
            </Button>
            <Button variant="ghost" size="sm" className="h-7" disabled={query.isFetchingNextPage} onClick={onExcludeAll}>
              Clear
            </Button>
          </span>
        </div>
        <ul className="-mx-2 grid max-h-80 content-start gap-0.5 overflow-y-auto">
          {accepted.slice(page * PICKER_PAGE, (page + 1) * PICKER_PAGE).map((r) => {
            const on = !skip.has(r.id)
            return (
              <li key={r.id}>
                <Label className="flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 font-normal hover:bg-accent/60">
                  <Checkbox
                    checked={on}
                    onCheckedChange={(v) => onExcludedChange((ids) => (v === true ? ids.filter((x) => x !== r.id) : [...ids, r.id]))}
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px]">{r.file.split("/").pop()}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{r.durationS.toFixed(1)} s</span>
                  <span className="w-16 text-right text-xs text-muted-foreground tabular-nums">{r.sizeMB} MB</span>
                </Label>
              </li>
            )
          })}
          {(query.isPending || query.error || query.isFetchingNextPage) && (
            <li className="px-2 py-4 text-center">
              {query.isFetchingNextPage ? <span className="text-[13px] text-muted-foreground">Loading…</span> : <QueryNote query={query} />}
            </li>
          )}
        </ul>
        <DialogFooter className="items-center sm:justify-between">
          {pages > 1 ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
              <Button variant="outline" size="sm" className="h-7" disabled={page === 0} onClick={() => setPage((n) => n - 1)}>
                Prev
              </Button>
              {page + 1} / {pages}
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                disabled={page >= pages - 1 || query.isFetchingNextPage}
                onClick={() => void next()}
              >
                Next
              </Button>
            </div>
          ) : (
            <span />
          )}
          <DialogClose render={<Button />}>Done</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

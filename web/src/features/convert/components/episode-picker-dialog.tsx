import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import type { Recording } from "@/domain/recording"

import { PICKER_PAGE } from "../lib"

/** Dialog for excluding accepted episodes from conversion. The parent keys it by task to reset the page */
export function EpisodePickerDialog({
  open,
  onOpenChange,
  taskId,
  accepted,
  excluded,
  onExcludedChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskId?: string
  accepted: Recording[]
  excluded: string[]
  onExcludedChange: (update: (ids: string[]) => string[]) => void
}) {
  const [page, setPage] = useState(0)
  const skip = new Set(excluded)
  const selected = accepted.filter((r) => !skip.has(r.id)).length
  const pages = Math.ceil(accepted.length / PICKER_PAGE)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-3 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose episodes</DialogTitle>
          <DialogDescription>{taskId} 의 승인된 에피소드 중 변환할 것을 고릅니다. 기본은 전부 선택입니다.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
          <span>
            {selected.toLocaleString()} of {accepted.length.toLocaleString()} selected
          </span>
          <span className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-7" onClick={() => onExcludedChange(() => [])}>
              Select all
            </Button>
            <Button variant="ghost" size="sm" className="h-7" onClick={() => onExcludedChange(() => accepted.map((r) => r.id))}>
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
        </ul>
        <DialogFooter className="items-center sm:justify-between">
          {pages > 1 ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
              <Button variant="outline" size="sm" className="h-7" disabled={page === 0} onClick={() => setPage((n) => n - 1)}>
                Prev
              </Button>
              {page + 1} / {pages}
              <Button variant="outline" size="sm" className="h-7" disabled={page >= pages - 1} onClick={() => setPage((n) => n + 1)}>
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

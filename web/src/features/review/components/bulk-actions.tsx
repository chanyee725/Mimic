import { LuCheck, LuTrash2, LuX } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { useBulkReview } from "@/api/recordings"
import type { RecordingReview } from "@/domain/recording"
import { plural } from "@/lib/format"

import { ErrorNote } from "@/components/common/query-state"

/** Accept, reject or delete every checked episode at once; replaces ReviewActions while any are checked */
export function BulkActions({ ids, onDone, onDelete }: { ids: string[]; onDone: () => void; onDelete: () => void }) {
  const review = useBulkReview()
  const mark = (r: RecordingReview) => review.mutate({ ids, review: r }, { onSuccess: onDone })

  return (
    <div className="grid shrink-0 gap-3 border-t pt-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium tabular-nums">{plural(ids.length, "episode")} selected</span>
      </div>
      <p className="text-xs text-muted-foreground">선택한 에피소드를 한 번에 승인, 거절하거나 지웁니다.</p>
      <ErrorNote error={review.error} />
      <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5">
        <Button variant="outline" className="h-9" disabled={review.isPending} onClick={() => mark("accepted")}>
          <LuCheck />
          Accept
        </Button>
        <Button variant="outline" className="h-9" disabled={review.isPending} onClick={() => mark("rejected")}>
          <LuX />
          Reject
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Delete selected"
          title="Delete selected"
          className="size-9 text-bad hover:text-bad"
          disabled={review.isPending}
          onClick={onDelete}
        >
          <LuTrash2 />
        </Button>
      </div>
    </div>
  )
}

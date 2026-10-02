import { LuCheck, LuTrash2, LuX } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { StatusDot } from "@/components/common/status-dot"
import type { Recording } from "@/dummy/recordings"
import { setReview } from "@/api/recordings"
import { cn } from "@/lib/utils"

import { REVIEW_TONE } from "../lib"

/** Validation results of the selected episode with accept, reject and delete buttons */
export function ReviewActions({ recording, onDelete }: { recording: Recording; onDelete: () => void }) {
  return (
    <div className="grid shrink-0 gap-3 border-t pt-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[13px] font-medium">{recording.file.split("/").pop()}</span>
        <StatusDot tone={REVIEW_TONE[recording.review]} className="shrink-0 text-xs text-muted-foreground">
          {recording.review}
        </StatusDot>
      </div>
      <dl className="grid gap-1">
        {recording.checks.map((c) => (
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
      <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5">
        <Button
          variant="outline"
          className="h-9"
          onClick={() => setReview(recording.id, "accepted")}
          disabled={recording.review === "accepted"}
        >
          <LuCheck />
          Accept
        </Button>
        <Button
          variant="outline"
          className="h-9"
          onClick={() => setReview(recording.id, "rejected")}
          disabled={recording.review === "rejected"}
        >
          <LuX />
          Reject
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Delete recording"
          title="Delete recording"
          className="size-9 text-bad hover:text-bad"
          onClick={onDelete}
        >
          <LuTrash2 />
        </Button>
      </div>
    </div>
  )
}

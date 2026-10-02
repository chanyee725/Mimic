import { ProgressBar } from "@/components/common/progress-bar"
import type { Outcome, Task } from "@/domain/task"
import { formatClock } from "@/lib/format"
import { cn } from "@/lib/utils"

import { PHASE, type Phase } from "../lib"

/** Phase badge, elapsed bar, episode number and time */
export function RecordingStatus({
  task,
  phase,
  episode,
  elapsedMs,
  lastOutcome,
}: {
  task: Task
  phase: Phase
  episode: number
  elapsedMs: number
  lastOutcome: Outcome | null
}) {
  const pct = Math.min(100, (elapsedMs / (task.durationS * 1000)) * 100)
  return (
    <div className="grid gap-2">
      <span
        className={cn("flex h-10 items-center rounded-md px-3 text-[13px] font-semibold tracking-wider", PHASE[phase].className)}
        aria-live="polite"
      >
        <span className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full bg-current", phase === "recording" && "animate-pulse")} />
          {PHASE[phase].label}
        </span>
      </span>
      {/* Updated every 100 ms, so the bar animates its width and keeps a square end */}
      <ProgressBar
        value={pct}
        label="Episode elapsed"
        tone="foreground"
        size="xs"
        className="[&>div]:rounded-none [&>div]:transition-[width]"
      />
      <div className="flex justify-between gap-2 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
        <span className="truncate">
          Episode {episode}
          {lastOutcome ? ` · ${lastOutcome}` : ""}
        </span>
        <span>
          {formatClock(elapsedMs / 1000)} / {formatClock(task.durationS)}
        </span>
      </div>
    </div>
  )
}

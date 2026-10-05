import { ProgressBar } from "@/components/common/progress-bar"
import type { CapturePhase } from "@/domain/capture"
import type { Outcome, Task } from "@/domain/task"
import { formatClock } from "@/lib/format"
import { cn } from "@/lib/utils"

import { PHASE } from "../lib"

/** Phase badge (a gauge that drains during the GET READY countdown), episode elapsed bar, episode number and time */
export function RecordingStatus({
  task,
  phase,
  episode,
  elapsedS,
  countdownLeftS,
  lastOutcome,
}: {
  task: Task
  phase: CapturePhase
  episode: number
  elapsedS: number
  countdownLeftS: number | null
  lastOutcome: Outcome | null
}) {
  const counting = countdownLeftS !== null
  const leftPct = counting && task.countdownS > 0 ? Math.min(100, (countdownLeftS / task.countdownS) * 100) : 0
  const pct = Math.min(100, (elapsedS / task.durationS) * 100)
  return (
    <div className="grid gap-2">
      <span
        className={cn(
          "relative flex h-10 items-center justify-between overflow-hidden rounded-md px-3 text-[13px] font-semibold tracking-wider",
          PHASE[phase].className,
        )}
        aria-live="polite"
      >
        {counting && (
          <span
            role="progressbar"
            aria-label="Countdown left"
            aria-valuenow={Math.round(leftPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="absolute inset-y-0 left-0 bg-info/15 transition-[width] duration-100 ease-linear"
            style={{ width: `${leftPct}%` }}
          />
        )}
        <span className="relative flex items-center gap-2">
          <span className={cn("size-2 rounded-full bg-current", phase === "recording" && "animate-pulse")} />
          {PHASE[phase].label}
        </span>
        {counting && <span className="relative text-base tabular-nums">{countdownLeftS.toFixed(1)}s</span>}
      </span>
      {/* Updated every 100 ms, so the bar animates its width linearly and keeps a square end */}
      <ProgressBar
        value={pct}
        label="Episode elapsed"
        tone="foreground"
        size="xs"
        className="[&>div]:rounded-none [&>div]:transition-[width] [&>div]:duration-100 [&>div]:ease-linear"
      />
      <div className="flex justify-between gap-2 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
        <span className="truncate">
          Episode {episode}
          {lastOutcome && !counting ? ` · ${lastOutcome}` : ""}
        </span>
        <span>
          {formatClock(elapsedS)} / {formatClock(task.durationS)}
        </span>
      </div>
    </div>
  )
}

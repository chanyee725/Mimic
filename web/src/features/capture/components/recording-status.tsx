import { ProgressBar } from "@/components/app/progress-bar"
import type { Outcome, Task } from "@/dummy/tasks"
import { formatClock } from "@/lib/format"
import { cn } from "@/lib/utils"

import { PHASE, type Phase } from "../lib"

/** 녹화 단계 배지 · 경과 막대 · 에피소드 번호와 시간 */
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
      {/* 100 ms 마다 갱신되므로 막대는 transition 으로 부드럽게, 끝은 각지게 */}
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

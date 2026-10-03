import { LuCheck, LuPlay, LuSquare, LuX } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { ProgressBar } from "@/components/common/progress-bar"
import { StatusDot } from "@/components/common/status-dot"
import { formatClock } from "@/lib/format"
import { cn } from "@/lib/utils"

import type { EvalJudgement } from "@/domain/evaluate"

import type { RunPhase } from "../lib"

/** Run status, elapsed time and per-phase buttons (run -> stop -> judge Success / Fail) */
export function RunControls({
  phase,
  elapsed,
  limitS,
  canStart,
  pending,
  onStart,
  onStop,
  onJudge,
}: {
  phase: RunPhase
  elapsed: number
  limitS: number
  canStart: boolean
  /** A start / stop / judge request is in flight */
  pending: boolean
  onStart: () => void
  onStop: () => void
  onJudge: (result: EvalJudgement) => void
}) {
  const running = phase === "running"

  return (
    <div className="grid gap-3 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <StatusDot
          tone={running ? "info" : phase === "judging" ? "warn" : "muted"}
          className={cn("text-[13px]", running && "[&>span]:animate-pulse")}
        >
          {running ? "Policy running" : phase === "judging" ? "Did it work?" : "Ready"}
        </StatusDot>
        <span className="font-mono text-2xl font-medium tabular-nums">{formatClock(elapsed / 1000)}</span>
      </div>
      {running && <ProgressBar size="xs" value={Math.min(100, (elapsed / (limitS * 1000)) * 100)} label="Run time" />}

      {phase === "idle" && (
        <Button size="lg" className="w-full" disabled={!canStart} onClick={onStart}>
          <LuPlay />
          Run policy
          <Kbd className="ml-auto">Space</Kbd>
        </Button>
      )}
      {running && (
        <Button size="lg" variant="outline" className="w-full text-bad hover:text-bad" disabled={pending} onClick={onStop}>
          <LuSquare />
          Stop
          <Kbd className="ml-auto">Esc</Kbd>
        </Button>
      )}
      {phase === "judging" && (
        <div className="grid gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Button className="bg-ok text-white hover:bg-ok/90" disabled={pending} onClick={() => onJudge("success")}>
              <LuCheck />
              Success
              <Kbd className="ml-auto">S</Kbd>
            </Button>
            <Button variant="outline" className="text-bad hover:text-bad" disabled={pending} onClick={() => onJudge("fail")}>
              <LuX />
              Fail
              <Kbd className="ml-auto">F</Kbd>
            </Button>
          </div>
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => onJudge("discard")}>
            Discard this run
          </Button>
        </div>
      )}
    </div>
  )
}

import { LuCheck, LuPlay, LuSquare, LuX } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { StatusDot } from "@/components/common/status-dot"
import { formatClock } from "@/lib/format"
import { cn } from "@/lib/utils"

import type { EvalJudgement } from "@/domain/evaluate"

import type { RunPhase } from "../lib"

/** Run status, elapsed time and per-phase buttons (run -> stop -> judge Success / Fail) */
export function RunControls({
  phase,
  elapsed,
  canStart,
  pending,
  error,
  onStart,
  onStop,
  onJudge,
}: {
  phase: RunPhase
  elapsed: number
  canStart: boolean
  /** A start / stop / judge request is in flight */
  pending: boolean
  /** Why the run ended early; it is judged but not counted */
  error: string | null
  onStart: () => void
  onStop: () => void
  onJudge: (result: EvalJudgement) => void
}) {
  const running = phase === "running"
  const loading = phase === "loading"

  return (
    <div className="grid gap-3 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <StatusDot
          tone={running || loading ? "info" : phase === "judging" ? (error ? "bad" : "warn") : "muted"}
          className={cn("text-[13px]", (running || loading) && "[&>span]:animate-pulse")}
        >
          {loading
            ? "Loading policy…"
            : running
              ? "Policy running"
              : phase === "judging"
                ? error
                  ? "Run ended"
                  : "Did it work?"
                : "Ready"}
        </StatusDot>
        <span className="font-mono text-2xl font-medium tabular-nums">{formatClock(elapsed / 1000)}</span>
      </div>
      {phase === "judging" && error && <p className="text-[13px] text-bad">{error}</p>}
      {phase === "judging" && (
        <p className="text-xs text-muted-foreground">팔은 지금 자세를 유지합니다. 판정하면 토크가 꺼지니 팔을 받치세요.</p>
      )}

      {phase === "idle" && (
        <Button size="lg" className="w-full" disabled={!canStart} onClick={onStart}>
          <LuPlay />
          Run policy
          <Kbd className="ml-auto">Space</Kbd>
        </Button>
      )}
      {(running || loading) && (
        <Button size="lg" variant="outline" className="w-full text-bad hover:text-bad" disabled={pending} onClick={onStop}>
          <LuSquare />
          Stop
          <Kbd className="ml-auto">Esc</Kbd>
        </Button>
      )}
      {phase === "judging" && (
        <div className="grid gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Button className="bg-ok text-white hover:bg-ok/90" disabled={pending || !!error} onClick={() => onJudge("success")}>
              <LuCheck />
              Success
              <Kbd className="ml-auto">S</Kbd>
            </Button>
            <Button variant="outline" className="text-bad hover:text-bad" disabled={pending || !!error} onClick={() => onJudge("fail")}>
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

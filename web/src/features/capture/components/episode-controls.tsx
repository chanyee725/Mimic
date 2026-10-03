import { LuCircle, LuSquare } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import type { CapturePhase } from "@/domain/capture"
import type { Outcome } from "@/domain/task"
import { cn } from "@/lib/utils"

import { ErrorNote } from "./query-note"

/** Start / stop plus save, re-record and discard buttons (with hotkey hints) */
export function EpisodeControls({
  phase,
  busy,
  error,
  onToggle,
  onSave,
  onRestart,
  onDiscard,
}: {
  phase: CapturePhase
  /** A transition is in flight (or the state is not loaded yet) */
  busy: boolean
  error: Error | null
  onToggle: () => void
  onSave: (outcome: Outcome) => void
  onRestart: () => void
  onDiscard: () => void
}) {
  const recording = phase === "recording"
  const idle = phase === "idle"
  const countdown = phase === "countdown"
  const canSave = !busy && (recording || phase === "review")
  return (
    <div className="mt-auto grid gap-2">
      <ErrorNote error={error} />
      <Button
        onClick={onToggle}
        disabled={busy || countdown}
        className={cn("h-11 w-full", recording && "bg-destructive text-white hover:bg-destructive/90")}
      >
        {recording ? <LuSquare /> : <LuCircle />}
        {recording ? "Stop" : countdown ? "Starting…" : phase === "review" ? "Re-record" : "Start"}
        <Kbd className="ml-auto bg-transparent text-current opacity-60">Space</Kbd>
      </Button>
      {/* Narrow column, so one button per row */}
      <div className="grid gap-1.5">
        <Button variant="outline" className="h-9 justify-between px-3" disabled={!canSave} onClick={() => onSave("success")}>
          Save as success <Kbd>→</Kbd>
        </Button>
        <Button variant="outline" className="h-9 justify-between px-3" disabled={!canSave} onClick={() => onSave("fail")}>
          Save as fail <Kbd>F</Kbd>
        </Button>
        <Button variant="outline" className="h-9 justify-between px-3" disabled={busy || idle} onClick={onRestart}>
          Re-record <Kbd>←</Kbd>
        </Button>
        <Button variant="outline" className="h-9 justify-between px-3 text-bad" disabled={busy || idle} onClick={onDiscard}>
          Discard <Kbd>Esc</Kbd>
        </Button>
      </div>
    </div>
  )
}

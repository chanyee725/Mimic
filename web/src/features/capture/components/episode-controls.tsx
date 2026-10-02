import { LuCircle, LuSquare } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import type { Outcome } from "@/dummy/tasks"
import { cn } from "@/lib/utils"

import type { Phase } from "../lib"

/** 녹화 시작 / 정지와 저장 · 재녹화 · 폐기 버튼 (단축키 표시 포함) */
export function EpisodeControls({
  phase,
  onToggle,
  onSave,
  onRestart,
  onDiscard,
}: {
  phase: Phase
  onToggle: () => void
  onSave: (outcome: Outcome) => void
  onRestart: () => void
  onDiscard: () => void
}) {
  const recording = phase === "recording"
  const idle = phase === "idle"
  return (
    <div className="mt-auto grid gap-2">
      <Button onClick={onToggle} className={cn("h-11 w-full", recording && "bg-destructive text-white hover:bg-destructive/90")}>
        {recording ? <LuSquare /> : <LuCircle />}
        {recording ? "Stop" : "Start"}
        <Kbd className="ml-auto bg-transparent text-current opacity-60">Space</Kbd>
      </Button>
      {/* 좁은 열이라 한 줄에 하나씩 */}
      <div className="grid gap-1.5">
        <Button variant="outline" className="h-9 justify-between px-3" disabled={idle} onClick={() => onSave("success")}>
          Save as success <Kbd>→</Kbd>
        </Button>
        <Button variant="outline" className="h-9 justify-between px-3" disabled={idle} onClick={() => onSave("fail")}>
          Save as fail <Kbd>F</Kbd>
        </Button>
        <Button variant="outline" className="h-9 justify-between px-3" disabled={idle} onClick={onRestart}>
          Re-record <Kbd>←</Kbd>
        </Button>
        <Button variant="outline" className="h-9 justify-between px-3 text-bad" disabled={idle} onClick={onDiscard}>
          Discard <Kbd>Esc</Kbd>
        </Button>
      </div>
    </div>
  )
}

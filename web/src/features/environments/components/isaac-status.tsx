import { LuSquare } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { ErrorNote } from "@/components/common/query-state"
import { StatusDot, type Tone } from "@/components/common/status-dot"
import { useSimRunner, useStopSimRunner } from "@/api/simulation"
import type { SimRunner } from "@/domain/simulation"

function describe(r: SimRunner, scene: string): { tone: Tone; text: string } {
  const where = r.mode === "local" ? "this station" : r.url
  if (!r.reachable) {
    return r.mode === "local" ? { tone: "muted", text: "Isaac Sim off" } : { tone: "bad", text: `Isaac Sim server unreachable (${r.url})` }
  }
  const app = r.app
  if (!app || app.state === "stopped") return { tone: "muted", text: `Isaac Sim stopped, ${where}` }
  if (app.state === "exited") return { tone: "bad", text: app.error ?? "Isaac Sim exited" }
  if (app.state === "starting") return { tone: "info", text: `Isaac Sim starting (${app.display}), ${where}…` }
  const open = app.scene === scene ? "this one is open" : app.scene ? `${app.scene} is open` : "no scene open"
  return { tone: "ok", text: `Isaac Sim running (${app.display}), ${open}` }
}

/** scene: the env id, or robot-<id> / tool-<id> */
export function IsaacStatus({ scene }: { scene: string }) {
  const runner = useSimRunner()
  const stop = useStopSimRunner()
  if (!runner.data) return <ErrorNote error={runner.error} onRetry={() => void runner.refetch()} />
  const { tone, text } = describe(runner.data, scene)
  const active = runner.data.app?.state === "starting" || runner.data.app?.state === "running"

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
      <StatusDot tone={tone} className="min-w-0 text-[13px] text-muted-foreground">
        <span className="min-w-0 [overflow-wrap:anywhere]">{text}</span>
      </StatusDot>
      {active && (
        <Button variant="ghost" size="xs" disabled={stop.isPending} onClick={() => stop.mutate()}>
          <LuSquare />
          {stop.isPending ? "Stopping…" : "Stop"}
        </Button>
      )}
      <ErrorNote error={stop.error} />
    </div>
  )
}

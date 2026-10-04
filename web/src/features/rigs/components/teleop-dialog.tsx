import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ErrorNote } from "@/components/common/query-state"
import { StatusDot } from "@/components/common/status-dot"
import { useStartTeleop, useStopTeleop, useTeleop } from "@/api/rigs"
import type { Rig } from "@/domain/rig"
import type { TeleopPair } from "@/domain/teleop"
import { cn } from "@/lib/utils"

/** Leader / follower gap (degrees, or % for the gripper) shown as a warning */
const GAP_WARN = 10

const num = (v: number | null) => (v === null ? "—" : v.toFixed(1))

/** Teleoperation test: every leader drives its follower; joint values update live */
export function TeleopDialog({ rig, open, onOpenChange }: { rig: Rig; open: boolean; onOpenChange: (open: boolean) => void }) {
  const teleopQuery = useTeleop(rig.id)
  const start = useStartTeleop()
  const stop = useStopTeleop()
  const state = teleopQuery.data
  const running = !!state?.running

  const close = () => {
    // Leaving while it runs stops the followers
    if (running) stop.mutate(rig.id)
    start.reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Test teleoperation · {rig.name}</DialogTitle>
          <DialogDescription>
            leader 를 움직이면 follower 가 따라 움직입니다. 시작하면 follower 토크가 켜지고, 멀리 떨어진 자세는 천천히 따라갑니다. Stop 하면
            follower 토크가 꺼지니 팔을 받치세요.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3 text-[13px]">
          <StatusDot tone={running ? "ok" : state?.error ? "bad" : "muted"} className="text-[13px]">
            {running ? "Running" : state?.error ? "Stopped" : "Idle"}
          </StatusDot>
          <span className="text-muted-foreground tabular-nums">
            {state ? `${state.hz === null ? "—" : state.hz.toFixed(1)} / ${state.targetHz} Hz` : `— / ${rig.targetHz.action} Hz`}
          </span>
        </div>

        {state && (
          <div className="grid max-h-[55vh] gap-4 overflow-y-auto">
            {state.pairs.map((p) => (
              <PairTable key={p.robot} pair={p} multiple={state.pairs.length > 1} />
            ))}
          </div>
        )}
        {state?.error && <p className="text-[13px] text-bad">{state.error}</p>}
        <ErrorNote error={start.error ?? stop.error} />

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={stop.isPending}>
            Close
          </Button>
          {running ? (
            <Button disabled={stop.isPending} onClick={() => stop.mutate(rig.id)}>
              {stop.isPending ? "Stopping…" : "Stop"}
            </Button>
          ) : (
            <Button disabled={start.isPending} onClick={() => start.mutate(rig.id)}>
              {start.isPending ? "Connecting…" : "Start"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PairTable({ pair, multiple }: { pair: TeleopPair; multiple: boolean }) {
  return (
    <div className="grid gap-1.5">
      {multiple && (
        <span className="text-xs text-muted-foreground">
          {pair.teleop} → {pair.robot}
        </span>
      )}
      <table className="w-full text-[13px] tabular-nums">
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th className="py-1.5 text-left font-normal">Joint</th>
            <th className="w-24 py-1.5 text-right font-normal">Leader</th>
            <th className="w-24 py-1.5 text-right font-normal">Follower</th>
            <th className="w-20 py-1.5 text-right font-normal">Δ</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {pair.joints.map((j) => {
            const gap = j.leader !== null && j.follower !== null ? j.follower - j.leader : null
            return (
              <tr key={j.name}>
                <td className="py-1.5">{j.name}</td>
                <td className="py-1.5 text-right">{num(j.leader)}</td>
                <td className="py-1.5 text-right">{num(j.follower)}</td>
                <td className={cn("py-1.5 text-right", gap !== null && Math.abs(gap) > GAP_WARN && "text-warn")}>{num(gap)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

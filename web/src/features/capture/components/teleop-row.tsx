import { Button } from "@/components/ui/button"
import { ErrorNote } from "@/components/common/query-state"
import { StatusDot } from "@/components/common/status-dot"
import { useStartTeleop, useStopTeleop, useTeleopStatus } from "@/api/rigs"

/** Teleop (leader → follower) status of the rig, with Start / Stop. Capture start also starts it */
export function TeleopRow({ rigId, locked }: { rigId: string; locked: boolean }) {
  const status = useTeleopStatus(rigId)
  const start = useStartTeleop()
  const stop = useStopTeleop()
  const state = status.data
  const running = !!state?.running

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <StatusDot tone={running ? "ok" : state?.error ? "bad" : "muted"} className="text-[13px]">
          {running ? `Teleop running · ${state?.hz === null || !state ? "—" : state.hz.toFixed(1)} Hz` : "Teleop off"}
        </StatusDot>
        {running ? (
          <Button
            variant="outline"
            size="xs"
            disabled={locked || stop.isPending}
            title="Stop 하면 follower 토크가 꺼집니다. 팔을 받친 뒤 누르세요."
            onClick={() => stop.mutate(rigId)}
          >
            {stop.isPending ? "Stopping…" : "Stop teleop"}
          </Button>
        ) : (
          <Button variant="outline" size="xs" disabled={locked || start.isPending} onClick={() => start.mutate(rigId)}>
            {start.isPending ? "Connecting…" : "Start teleop"}
          </Button>
        )}
      </div>
      {running ? (
        <span className="text-xs text-muted-foreground">Stop 하면 follower 토크가 꺼지니 팔을 받치세요.</span>
      ) : (
        <span className="text-xs text-muted-foreground">녹화를 시작하면 teleop 도 함께 켜집니다.</span>
      )}
      {state?.error && !running && <span className="text-[13px] text-bad">{state.error}</span>}
      <ErrorNote error={start.error ?? stop.error ?? status.error} />
    </div>
  )
}

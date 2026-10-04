import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ErrorNote } from "@/components/common/query-state"
import { useCalibration, useCancelCalibration, useNextCalibrationStep, useStartCalibration } from "@/api/devices"
import { ApiError } from "@/api/client"
import type { CalibrationSession, CalibrationStep, Device, MotorRange } from "@/domain/device"
import { isCalibrating } from "@/domain/device"
import { cn } from "@/lib/utils"

import { ENCODER_MAX } from "../lib"

const STEPS: { key: CalibrationStep; label: string }[] = [
  { key: "center", label: "Center" },
  { key: "range", label: "Range" },
  { key: "done", label: "Save" },
]

const HINT: Record<CalibrationStep | "idle", string> = {
  idle: "시작하면 모든 모터의 토크가 꺼집니다. 팔이 처지지 않도록 손으로 받칠 준비를 하세요. 결과는 LeRobot 캘리브레이션 파일로 저장됩니다.",
  center: "모든 관절을 각 가동 범위의 가운데로 옮긴 뒤 Next 를 누르세요.",
  range: "회전 관절(wrist_roll)을 제외한 모든 관절을 끝에서 끝까지 천천히 움직인 뒤 Finish 를 누르세요.",
  done: "캘리브레이션을 모터에 쓰고 파일로 저장했습니다.",
  failed: "캘리브레이션이 중단되었습니다. 연결을 확인하고 다시 시작하세요.",
}

/** Step-by-step arm calibration (center → range → save); joint positions update live */
export function CalibrationDialog({
  device,
  active,
  open,
  onOpenChange,
}: {
  device: Device
  active: boolean // the device reports a running session
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  // Polled only while a session runs; Start / Next put their result in the cache
  const sessionQuery = useCalibration(device.id, open && active)
  const start = useStartCalibration()
  const next = useNextCalibrationStep()
  const cancel = useCancelCalibration()
  const session = sessionQuery.data
  const running = isCalibrating(session)
  const step = session?.step ?? "idle"
  const busy = start.isPending || next.isPending || cancel.isPending
  // 409 on Finish names the joints that have not moved
  const still = next.error instanceof ApiError ? next.error.details.motors : undefined
  const nextError = Array.isArray(still) ? new Error(`${next.error?.message}: ${still.join(", ")}`) : next.error

  const close = () => {
    // Leaving mid-way releases the port (torque stays off)
    if (running) cancel.mutate(device.id)
    start.reset()
    next.reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Calibrate {device.name}</DialogTitle>
          <DialogDescription>{HINT[step]}</DialogDescription>
        </DialogHeader>

        <ol className="flex gap-4 text-[13px]">
          {STEPS.map((s, i) => (
            <li
              key={s.key}
              className={cn("flex items-center gap-1.5", s.key === session?.step ? "font-medium text-foreground" : "text-muted-foreground")}
            >
              <span className="tabular-nums">{i + 1}</span>
              {s.label}
            </li>
          ))}
        </ol>

        {session && <MotorTable session={session} />}
        {session?.step === "done" && session.file && (
          <p className="text-xs break-all text-muted-foreground">
            Saved to <span className="font-mono">{session.file}</span>
          </p>
        )}
        {session?.step === "failed" && <p className="text-[13px] text-bad">{session.message}</p>}
        <ErrorNote error={start.error ?? nextError ?? cancel.error ?? sessionQuery.error} />

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={cancel.isPending}>
            {running ? "Cancel" : "Close"}
          </Button>
          {running ? (
            <Button disabled={busy} onClick={() => next.mutate(device.id)}>
              {session?.step === "center" ? "Next" : next.isPending ? "Saving…" : "Finish"}
            </Button>
          ) : (
            <Button disabled={busy} onClick={() => start.mutate(device.id)}>
              {start.isPending ? "Connecting…" : session ? "Calibrate again" : "Start"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Joint table: live position, and in the range step the recorded min / max over the encoder span */
function MotorTable({ session }: { session: CalibrationSession }) {
  return (
    <table className="w-full text-[13px] tabular-nums">
      <thead className="text-xs text-muted-foreground">
        <tr>
          <th className="py-1.5 text-left font-normal">Joint</th>
          <th className="w-16 py-1.5 text-right font-normal">Min</th>
          <th className="w-16 py-1.5 text-right font-normal">Pos</th>
          <th className="w-16 py-1.5 text-right font-normal">Max</th>
          <th className="w-40 py-1.5 pl-4 font-normal" />
        </tr>
      </thead>
      <tbody className="divide-y">
        {session.motors.map((m) => (
          <tr key={m.name}>
            <td className="py-1.5">{m.name}</td>
            <td className="py-1.5 text-right">{m.fullTurn ? "0" : (m.min ?? "—")}</td>
            <td className="py-1.5 text-right">{m.pos ?? "—"}</td>
            <td className="py-1.5 text-right">{m.fullTurn ? ENCODER_MAX : (m.max ?? "—")}</td>
            <td className="py-1.5 pl-4">
              <RangeBar motor={m} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function RangeBar({ motor }: { motor: MotorRange }) {
  const pct = (v: number) => `${(Math.max(0, Math.min(ENCODER_MAX, v)) / ENCODER_MAX) * 100}%`
  const lo = motor.fullTurn ? 0 : motor.min
  const hi = motor.fullTurn ? ENCODER_MAX : motor.max
  return (
    <div className="relative h-1.5 rounded-full bg-muted" aria-hidden>
      {lo !== null && hi !== null && (
        <div
          className={cn("absolute inset-y-0 rounded-full", motor.fullTurn ? "bg-muted-foreground/30" : "bg-info")}
          style={{ left: pct(lo), width: `calc(${pct(hi)} - ${pct(lo)})` }}
        />
      )}
      {motor.pos !== null && <div className="absolute -inset-y-1 w-0.5 rounded bg-foreground" style={{ left: pct(motor.pos) }} />}
    </div>
  )
}

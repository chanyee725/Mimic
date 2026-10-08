import { StatusDot } from "@/components/common/status-dot"
import { SIM_KEYBOARD, type SimTeleop } from "@/domain/simulation"

import { formatJoint, TELEOP_STATE } from "../lib"
import { KeyboardJog } from "./keyboard-jog"

export function TeleopSession({ session }: { session: SimTeleop }) {
  const { tone, label } = TELEOP_STATE[session.state]
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3 text-[13px]">
        <StatusDot tone={session.error ? "bad" : tone} className="text-[13px]">
          {label} · <span className="font-mono">{session.deviceId}</span> → <span className="font-mono">{session.robotId}</span>
        </StatusDot>
        <span className="text-muted-foreground tabular-nums">
          {session.hz === null ? "—" : session.hz.toFixed(1)} / {session.targetHz} Hz
        </span>
      </div>
      {session.state === "starting" && (
        <p className="text-xs text-muted-foreground">Isaac Sim 이 로봇을 여는 중입니다. 처음 실행하면 몇 분 걸릴 수 있습니다.</p>
      )}
      {session.error && <p className="text-[13px] [overflow-wrap:anywhere] text-bad">{session.error}</p>}
      {session.deviceId === SIM_KEYBOARD
        ? session.joints.length > 0 && <KeyboardJog session={session} />
        : session.joints.length > 0 && (
            <table className="w-full text-[13px] tabular-nums">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-1.5 text-left font-normal">Joint</th>
                  <th className="w-28 py-1.5 text-right font-normal">Leader</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {session.joints.map((j) => (
                  <tr key={j.name}>
                    <td className="py-1.5">{j.name}</td>
                    <td className="py-1.5 text-right">{formatJoint(j.name, j.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
    </div>
  )
}

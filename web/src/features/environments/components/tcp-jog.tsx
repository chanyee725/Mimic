import type { SimTeleop } from "@/domain/simulation"
import { cn } from "@/lib/utils"

import { useTcpKeys } from "../hooks/use-tcp-keys"
import { TCP_KEYS } from "../lib"

const AXES = [
  { axis: "X", keys: "I / K", rot: "Roll" },
  { axis: "Y", keys: "J / L", rot: "Pitch" },
  { axis: "Z", keys: "U / O", rot: "Yaw" },
]

const signed = (dir: number) => (dir > 0 ? "+" : "−")

export function TcpJog({ session, link }: { session: SimTeleop; link: string }) {
  const held = useTcpKeys(session.state === "running")
  const pose = session.tcp
  const active = new Map(held.keys.map((k) => [TCP_KEYS[k].axis, TCP_KEYS[k].dir]))

  return (
    <div className="grid gap-2">
      <p className="text-xs text-muted-foreground">
        누르고 있는 동안 TCP (<span className="font-mono">{link}</span>) 가 자기 좌표계로 움직입니다. I/K 는 X, J/L 은 Y, U/O 는 Z 축이고,
        Shift 를 함께 누르면 같은 축을 기준으로 회전합니다. 여러 키를 함께 누를 수 있습니다.
      </p>
      <table className="w-full text-[13px] tabular-nums">
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th className="py-1.5 text-left font-normal">Axis</th>
            <th className="py-1.5 text-left font-normal">Keys</th>
            <th className="w-24 py-1.5 text-right font-normal">Position</th>
            <th className="w-28 py-1.5 text-right font-normal">Rotation</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {AXES.map((a, i) => {
            const dir = active.get(i)
            const moving = dir !== undefined && !held.rotate
            const turning = dir !== undefined && held.rotate
            return (
              <tr key={a.axis} className={cn(dir !== undefined && "bg-accent")}>
                <td className="px-1.5 py-1 font-mono text-xs">
                  {a.axis}
                  {dir !== undefined && <span className="ml-1 text-info">{signed(dir)}</span>}
                </td>
                <td className="py-1 font-mono text-xs text-muted-foreground">{a.keys}</td>
                <td className={cn("py-1 text-right", moving && "text-info")}>{pose ? `${(pose[i] * 1000).toFixed(1)} mm` : "—"}</td>
                <td className={cn("py-1 text-right", turning && "text-info")}>
                  <span className="mr-1.5 text-xs text-muted-foreground">{a.rot}</span>
                  {pose ? `${pose[3 + i].toFixed(1)}°` : "—"}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground">Position 과 Rotation 은 월드 좌표 기준의 현재 TCP 자세입니다.</p>
    </div>
  )
}

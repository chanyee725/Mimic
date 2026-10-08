import { LuMinus, LuPlus } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import type { SimTeleop } from "@/domain/simulation"
import { cn } from "@/lib/utils"

import { useJogKeys } from "../hooks/use-jog-keys"

/** Keyboard teleoperation: the robot's joints with their targets; keys or the −/+ buttons move the selected one */
export function KeyboardJog({ session }: { session: SimTeleop }) {
  const names = session.joints.map((j) => j.name)
  const running = session.state === "running"
  const jog = useJogKeys(names, running)

  const hold = (joint: string, dir: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      jog.select(joint)
      jog.press(joint, dir, e.shiftKey)
    },
    onPointerUp: jog.release,
    onPointerCancel: jog.release,
  })

  return (
    <div className="grid gap-2">
      <p className="text-xs text-muted-foreground">
        ↑/↓ (W/S) 로 관절을 고르고 ←/→ (A/D) 를 누르고 있는 동안 움직입니다. Shift 를 함께 누르면 천천히 움직이고, 관절 한계에서 멈춥니다.
      </p>
      <table className="w-full text-[13px] tabular-nums">
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th className="py-1.5 text-left font-normal">Joint</th>
            <th className="w-24 py-1.5 text-right font-normal">Target</th>
            <th className="w-20 py-1.5" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {session.joints.map((j) => {
            const on = j.name === jog.selected
            const moving = jog.held?.joint === j.name
            return (
              <tr key={j.name} className={cn(on && "bg-accent")} onClick={() => jog.select(j.name)}>
                <td className={cn("px-1.5 py-1 font-mono text-xs", on && "font-semibold")}>{j.name}</td>
                <td className={cn("py-1 text-right", moving && "text-info")}>{j.value === null ? "—" : `${j.value.toFixed(1)}°`}</td>
                <td className="py-1 text-right">
                  <span className="inline-flex gap-1">
                    <Button variant="outline" size="icon-xs" aria-label={`${j.name} −`} disabled={!running} {...hold(j.name, -1)}>
                      <LuMinus />
                    </Button>
                    <Button variant="outline" size="icon-xs" aria-label={`${j.name} +`} disabled={!running} {...hold(j.name, 1)}>
                      <LuPlus />
                    </Button>
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

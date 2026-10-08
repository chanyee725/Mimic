import { LuKeyboard, LuPlugZap } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { StatusDot } from "@/components/common/status-dot"
import type { Device, DeviceCheck } from "@/domain/device"
import { SIM_KEYBOARD } from "@/domain/simulation"
import { cn } from "@/lib/utils"

import { HEALTH_TONE } from "../lib"

export function LeaderPicker({
  leaders,
  fits,
  keyboard,
  value,
  onChange,
  disabled,
  testing,
  check,
  onTest,
}: {
  leaders: Device[]
  fits: (d: Device) => boolean
  keyboard: boolean
  value: string | undefined
  onChange: (id: string) => void
  disabled: boolean
  testing: boolean
  check: DeviceCheck | undefined
  onTest: () => void
}) {
  return (
    <div className="grid gap-2">
      <ul className="grid gap-0.5 rounded-md border p-1" role="radiogroup" aria-label="Leader device">
        <li>
          <button
            type="button"
            role="radio"
            aria-checked={keyboard}
            disabled={disabled}
            onClick={() => onChange(SIM_KEYBOARD)}
            className={cn(
              "flex w-full items-center gap-2 rounded-[5px] px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-accent/60 disabled:pointer-events-none disabled:opacity-60",
              keyboard && "bg-accent hover:bg-accent",
            )}
          >
            <LuKeyboard className="size-4 text-muted-foreground" aria-hidden />
            <span className={cn("flex-1", keyboard && "font-medium")}>Keyboard</span>
            <span className="text-xs text-muted-foreground">관절을 하나씩 움직입니다</span>
          </button>
        </li>
        {leaders.map((d) => {
          const on = !keyboard && d.id === value
          const ok = fits(d)
          return (
            <li key={d.id}>
              <button
                type="button"
                role="radio"
                aria-checked={on}
                disabled={disabled || !ok}
                title={ok ? undefined : `${d.driver ?? "알 수 없는 장치"} 는 이 로봇을 움직일 수 없습니다.`}
                onClick={() => onChange(d.id)}
                className={cn(
                  "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[5px] px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-accent/60 disabled:pointer-events-none disabled:opacity-60",
                  on && "bg-accent hover:bg-accent",
                )}
              >
                <span className="grid min-w-0">
                  <span className={cn("truncate", on && "font-medium")}>{d.name}</span>
                  <span className="truncate font-mono text-xs text-muted-foreground">
                    {d.id} · {d.driver ?? "unknown"} · {d.port || "no port"}
                  </span>
                </span>
                <StatusDot tone={HEALTH_TONE[d.health]} className="text-xs text-muted-foreground capitalize">
                  {d.health}
                </StatusDot>
              </button>
            </li>
          )
        })}
      </ul>

      {!keyboard && (
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || testing || !value || !leaders.some((d) => d.id === value && fits(d))}
            onClick={onTest}
          >
            <LuPlugZap />
            {testing ? "Testing…" : "Test connection"}
          </Button>
          {check ? (
            <StatusDot tone={check.ok ? "ok" : "bad"} className="min-w-0 text-[13px] text-muted-foreground">
              <span className="min-w-0 [overflow-wrap:anywhere]">{check.message || (check.ok ? "Connected" : "Failed")}</span>
            </StatusDot>
          ) : (
            <span className="text-xs text-muted-foreground">연결 테스트에 성공해야 시작할 수 있습니다.</span>
          )}
        </div>
      )}
    </div>
  )
}

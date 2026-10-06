import { StatusDot } from "@/components/common/status-dot"
import type { Device } from "@/domain/device"
import { cn } from "@/lib/utils"

import { HEALTH_TONE, rateClass, rateText } from "../lib"

export function DeviceRow({ device, selected, onSelect }: { device: Device; selected: boolean; onSelect: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          "grid w-full gap-x-6 gap-y-1.5 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-accent/60 @xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]",
          selected && "bg-accent hover:bg-accent",
        )}
      >
        <div className="grid min-w-0 gap-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <StatusDot tone={HEALTH_TONE[device.health]} />
            <span className={cn("truncate text-[13px]", selected ? "font-medium" : "font-normal")}>{device.name}</span>
          </div>
          <span className="truncate pl-3.5 text-xs text-muted-foreground">
            {device.simulated ? "Isaac Sim" : device.port}
            {!device.calibration.done && <span className="text-warn"> · {device.calibration.note}</span>}
          </span>
        </div>
        <div className="grid content-center gap-0.5 pl-3.5 @xl:pl-0">
          {device.streams.map((s) => (
            <div key={s.key} className="flex justify-between gap-3 text-xs">
              <span className="min-w-0 truncate text-muted-foreground">{s.key}</span>
              <span className={cn("shrink-0 tabular-nums", rateClass(s))}>{rateText(s)}</span>
            </div>
          ))}
        </div>
      </button>
    </li>
  )
}

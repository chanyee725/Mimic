import { DetailList } from "@/components/app/detail-list"
import { Panel } from "@/components/app/page"
import { StatusDot } from "@/components/app/status-dot"
import type { Device } from "@/dummy/devices"
import { cn } from "@/lib/utils"

import { HEALTH_TONE, rateClass, rateText, TYPE_LABEL } from "../lib"

/** Basic info for the selected device */
export function DeviceDetail({ device }: { device: Device }) {
  const info = [
    { k: "Type", v: TYPE_LABEL[device.type] },
    { k: "Port", v: device.port },
    { k: "Calibration", v: device.calibration.done ? "Done" : "Required" },
    ...device.stats.map((s) => ({ k: s.label, v: s.value })),
  ]

  return (
    <Panel
      title={device.name}
      action={
        <StatusDot tone={HEALTH_TONE[device.health]} className="text-[13px] text-muted-foreground">
          {device.health}
        </StatusDot>
      }
    >
      <div className="grid min-h-0 flex-1 content-start gap-5 overflow-y-auto">
        <DetailList rows={info} />
        <div className="grid gap-1.5">
          <span className="text-xs text-muted-foreground">Streams</span>
          <dl className="divide-y">
            {device.streams.map((s) => (
              <div key={s.key} className="flex justify-between gap-4 py-2 text-[13px]">
                <dt className="min-w-0 truncate">
                  {s.key} <span className="text-muted-foreground">{s.shape}</span>
                </dt>
                <dd className={cn("shrink-0 tabular-nums", rateClass(s))}>{rateText(s)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </Panel>
  )
}

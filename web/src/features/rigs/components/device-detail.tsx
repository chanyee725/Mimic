import { Button } from "@/components/ui/button"
import { Panel } from "@/components/layout/page-layout"
import { DetailList } from "@/components/common/detail-list"
import { StatusDot } from "@/components/common/status-dot"
import { useCalibrateDevice } from "@/api/devices"
import type { Device } from "@/domain/device"
import { cn } from "@/lib/utils"

import { HEALTH_TONE, rateClass, rateText, TYPE_LABEL } from "../lib"

/** Basic info for the selected device */
export function DeviceDetail({ device }: { device: Device }) {
  const calibrate = useCalibrateDevice()
  const calibrating = !device.calibration.done && /calibrating/i.test(device.calibration.note)
  const info = [
    { k: "Type", v: TYPE_LABEL[device.type] },
    { k: "Port", v: device.port },
    { k: "Calibration", v: device.calibration.done ? "Done" : device.calibration.note || "Required" },
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
        {/* Calibration runs on the station; the result comes back as a device.updated event */}
        <div className="grid gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="justify-self-start"
            disabled={calibrate.isPending || calibrating || device.health === "off"}
            onClick={() => calibrate.mutate(device.id)}
          >
            {calibrate.isPending || calibrating ? "Calibrating…" : "Calibrate"}
          </Button>
          {device.health === "off" && (
            <span className="text-xs text-muted-foreground">장치가 연결되어 있지 않아 캘리브레이션할 수 없습니다.</span>
          )}
          {calibrate.isError && calibrate.variables === device.id && (
            <span className="text-[13px] text-bad">{calibrate.error.message}</span>
          )}
        </div>
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

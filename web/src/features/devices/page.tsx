import { useState } from "react"
import { LuCable, LuCheck, LuCircleCheck, LuPlus, LuRefreshCw, LuTriangleAlert, LuWifi } from "react-icons/lu"

import { Page, Panel } from "@/components/app/page"
import { StatStrip } from "@/components/app/stat-strip"
import { StatusDot, type Tone } from "@/components/app/status-dot"
import { Button } from "@/components/ui/button"
import { CALIBRATION_STEPS, DEVICES, type Device, type DeviceStream, type Health } from "@/dummy/devices"
import { cn } from "@/lib/utils"

const HEALTH_TONE: Record<Health, Tone> = { ok: "ok", warn: "warn", off: "muted" }

function rateText(s: DeviceStream) {
  if (s.targetHz === null) return "event"
  const measured = s.measuredHz === null ? "—" : s.measuredHz.toFixed(1)
  return `${measured} / ${s.targetHz} ${s.unit}`
}

/** 실측 주기가 목표의 98% 미만이면 경고 색, 미측정이면 흐리게 */
function rateClass(s: DeviceStream) {
  if (s.targetHz === null) return "text-foreground"
  if (s.measuredHz === null) return "text-muted-foreground"
  return s.measuredHz / s.targetHz < 0.98 ? "text-warn" : "text-foreground"
}

function DeviceRow({ device, selected, onSelect }: { device: Device; selected: boolean; onSelect: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          "grid w-full gap-x-6 gap-y-2 rounded-md px-2 py-3 text-left transition-colors hover:bg-muted/50 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]",
          selected && "bg-muted/60 hover:bg-muted/60",
        )}
      >
        <div className="grid min-w-0 gap-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <StatusDot tone={HEALTH_TONE[device.health]} />
            <span className="truncate text-sm font-semibold">{device.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{device.type}</span>
          </div>
          <span className="truncate pl-3.5 font-mono text-xs text-muted-foreground">{device.port}</span>
          <span className={cn("pl-3.5 text-xs", device.calibration.done ? "text-muted-foreground" : "text-warn")}>
            {device.calibration.note}
          </span>
        </div>
        <div className="grid content-center gap-1">
          {device.streams.map((s) => (
            <div key={s.key} className="flex justify-between gap-3 font-mono text-xs">
              <span className="min-w-0 truncate">
                {s.key} <span className="text-muted-foreground">{s.shape}</span>
              </span>
              <span className={cn("shrink-0", rateClass(s))}>{rateText(s)}</span>
            </div>
          ))}
        </div>
      </button>
    </li>
  )
}

function DeviceDetail({ device }: { device: Device }) {
  const isGlove = device.type === "glove"
  const steps = CALIBRATION_STEPS[isGlove ? "glove" : "arm"]
  const done = device.calibration.done ? steps.length : 0

  return (
    <Panel title={device.name} action={<StatusDot tone={HEALTH_TONE[device.health]} className="text-[13px] text-muted-foreground">{device.health}</StatusDot>}>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
        <div className="grid gap-2.5">
          <span className="text-xs text-muted-foreground">Calibration</span>
          <ol className="grid gap-2.5">
            {steps.map((label, i) => {
              const isDone = i < done
              return (
                <li key={label} className="flex items-center gap-2.5 text-sm">
                  <span
                    className={cn(
                      "flex size-5.5 items-center justify-center rounded-full font-mono text-[11px] font-medium",
                      isDone ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {isDone ? <LuCheck className="size-3" /> : i + 1}
                  </span>
                  <span className={isDone ? "text-muted-foreground" : undefined}>{label}</span>
                </li>
              )
            })}
          </ol>
        </div>

        <div className="grid gap-2">
          <span className="text-xs text-muted-foreground">Health</span>
          <dl className="divide-y">
            {device.stats.map((s) => (
              <div key={s.label} className="flex justify-between py-2 text-sm">
                <dt className="text-muted-foreground">{s.label}</dt>
                <dd className="font-mono">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="lg" className="flex-1">
          Start calibration
        </Button>
        <Button size="lg" variant="outline" disabled={device.type === "camera" || device.type === "input"}>
          Torque off
        </Button>
      </div>
    </Panel>
  )
}

export function DevicesPage() {
  const [selectedId, setSelectedId] = useState("follower")
  const selected = DEVICES.find((d) => d.id === selectedId) ?? DEVICES[0]

  const stats = [
    { label: "Devices", value: DEVICES.length, icon: LuCable },
    { label: "Online", value: DEVICES.filter((d) => d.health !== "off").length, icon: LuWifi },
    { label: "Warnings", value: DEVICES.filter((d) => d.health === "warn").length, icon: LuTriangleAlert },
    {
      label: "Calibrated",
      value: `${DEVICES.filter((d) => d.calibration.done).length} / ${DEVICES.length}`,
      icon: LuCircleCheck,
    },
  ]

  return (
    <Page
      fit
      title="Devices"
      description="장치 플러그인의 describe() 결과로 스트림과 패널이 자동 구성됩니다."
      actions={
        <>
          <Button variant="outline" size="lg">
            <LuRefreshCw />
            Rescan ports
          </Button>
          <Button size="lg">
            <LuPlus />
            Add device
          </Button>
        </>
      }
    >
      <StatStrip items={stats} />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel title="Connected devices" action={<span className="text-[13px] text-muted-foreground">{DEVICES.length} devices</span>}>
          <ul className="-mx-2 min-h-0 flex-1 divide-y overflow-y-auto">
            {DEVICES.map((d) => (
              <DeviceRow key={d.id} device={d} selected={d.id === selected.id} onSelect={() => setSelectedId(d.id)} />
            ))}
          </ul>
        </Panel>
        <DeviceDetail device={selected} />
      </div>
    </Page>
  )
}

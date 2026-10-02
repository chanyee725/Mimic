import { useState } from "react"
import { LuCable, LuCircleCheck, LuPlus, LuRefreshCw, LuTriangleAlert, LuWifi } from "react-icons/lu"

import { Page, Panel } from "@/components/app/page"
import { StatStrip } from "@/components/app/stat-strip"
import { StatusDot, type Tone } from "@/components/app/status-dot"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { devicesOf, type Device, type DeviceStream, type Health } from "@/dummy/devices"
import { getRig, rigGroups, RIGS } from "@/dummy/rigs"
import { rigToYaml } from "./rig-yaml"
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
            {device.port}
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

/** Rig 전체 상태: 하나라도 경고면 warn, 모두 꺼져 있으면 off */
function rigHealth(devices: Device[]): Health {
  if (devices.every((d) => d.health === "off")) return "off"
  if (devices.some((d) => d.health !== "ok")) return "warn"
  return "ok"
}

function RigList({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  return (
    <Panel
      className="gap-2 p-3"
      title={
        <span className="flex items-baseline gap-1.5 px-2 text-[13px] font-medium">
          Rigs
          <span className="font-normal text-muted-foreground tabular-nums">{RIGS.length}</span>
        </span>
      }
      action={
        <Button variant="ghost" size="icon-sm" aria-label="Add rig" title="Add rig" className="text-muted-foreground">
          <LuPlus />
        </Button>
      }
    >
      <ul className="grid min-h-0 flex-1 content-start gap-0.5 overflow-y-auto">
        {RIGS.map((r) => {
          const devices = devicesOf(r.id)
          const online = devices.filter((d) => d.health !== "off").length
          const selected = r.id === selectedId
          return (
            <li key={r.id}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(r.id)}
                className={cn(
                  "grid w-full gap-0.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent/60",
                  selected && "bg-accent hover:bg-accent",
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <StatusDot tone={HEALTH_TONE[rigHealth(devices)]} />
                  <span className={cn("truncate text-[13px]", selected ? "font-medium" : "font-normal")}>{r.name}</span>
                </span>
                <span className="truncate pl-3.5 text-xs text-muted-foreground">
                  {r.master} → {r.slave}
                </span>
                <span className="pl-3.5 text-[11px] text-muted-foreground/80 tabular-nums">
                  {online}/{devices.length} online · {r.joints.length} DoF
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

const TYPE_LABEL: Record<Device["type"], string> = {
  robot: "Robot (follower)",
  teleop: "Teleop (leader)",
  camera: "Camera",
  glove: "Data glove",
  input: "Input",
}

/** 선택한 장치의 간단한 정보 */
function DeviceDetail({ device }: { device: Device }) {
  const info = [
    { label: "Type", value: TYPE_LABEL[device.type] },
    { label: "Port", value: device.port },
    { label: "Calibration", value: device.calibration.done ? "Done" : "Required" },
    ...device.stats.map((s) => ({ label: s.label, value: s.value })),
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
        <dl className="divide-y">
          {info.map((i) => (
            <div key={i.label} className="flex justify-between gap-4 py-2 text-[13px]">
              <dt className="text-muted-foreground">{i.label}</dt>
              <dd className="truncate text-right tabular-nums">{i.value}</dd>
            </div>
          ))}
        </dl>
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

export function RigsPage() {
  const [rigId, setRigId] = useState(RIGS[0].id)
  const rig = getRig(rigId)
  const devices = devicesOf(rig.id)
  const groups = rigGroups(rig)
  const [group, setGroup] = useState<string>("robot")
  const groupIds = groups.find((g) => g.key === group)?.ids ?? []
  const groupDevices = devices.filter((d) => groupIds.includes(d.id))
  const [selectedId, setSelectedId] = useState("follower")
  const selected = devices.find((d) => d.id === selectedId) ?? groupDevices[0] ?? devices[0]

  const selectRig = (id: string) => {
    setRigId(id)
    setGroup("robot")
    setSelectedId(devicesOf(id)[0]?.id ?? "")
  }
  const selectGroup = (key: string) => {
    setGroup(key)
    const first = groups.find((g) => g.key === key)?.ids[0]
    if (first) setSelectedId(first)
  }

  const stats = [
    { label: "Devices", value: devices.length, icon: LuCable },
    { label: "Online", value: devices.filter((d) => d.health !== "off").length, icon: LuWifi },
    { label: "Warnings", value: devices.filter((d) => d.health === "warn").length, icon: LuTriangleAlert },
    {
      label: "Calibrated",
      value: `${devices.filter((d) => d.calibration.done).length} / ${devices.length}`,
      icon: LuCircleCheck,
    },
  ]

  return (
    <Page
      fit
      title="Rigs"
      description="Rig 별 Robot · Device · Camera 의 연결 상태와 캘리브레이션을 관리합니다."
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

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,4fr)_minmax(0,3fr)]">
        <RigList selectedId={rig.id} onSelect={selectRig} />

        <Panel
          className="@container"
          title={rig.name}
          action={
            <span className="text-[13px] text-muted-foreground tabular-nums">
              {rig.joints.length} DoF · {rig.targetHz.action} Hz · {rig.targetHz.video} fps
            </span>
          }
        >
          {/* Rig 안의 장치를 Robot / Device / Camera 탭으로 나눠 본다 */}
          <Tabs value={group} onValueChange={(v) => selectGroup(String(v))} className="min-h-0 flex-1">
            <TabsList>
              {groups.map((g) => (
                <TabsTrigger key={g.key} value={g.key} className="gap-1.5 px-3">
                  {g.label}
                  <span className="text-xs text-muted-foreground tabular-nums">{g.ids.length}</span>
                </TabsTrigger>
              ))}
              <TabsTrigger value="config" className="px-3">
                Config
              </TabsTrigger>
            </TabsList>
            {/* Rig 설정 파일: Robot / Device / Camera 구성이 여기에 기록된다 */}
            <TabsContent value="config" className="min-h-0 flex-1 overflow-y-auto">
              <pre className="rounded-md bg-muted p-4 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">
                {rigToYaml(rig)}
              </pre>
            </TabsContent>
            {groups.map((g) => (
              <TabsContent key={g.key} value={g.key} className="-mx-2 min-h-0 flex-1 overflow-y-auto">
                {groupDevices.length === 0 ? (
                  <p className="px-2 py-6 text-center text-[13px] text-muted-foreground">이 Rig 에 {g.label} 장치가 없습니다.</p>
                ) : (
                  <ul className="grid gap-0.5">
                    {groupDevices.map((d) => (
                      <DeviceRow key={d.id} device={d} selected={d.id === selected?.id} onSelect={() => setSelectedId(d.id)} />
                    ))}
                  </ul>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </Panel>

        {selected && <DeviceDetail device={selected} />}
      </div>
    </Page>
  )
}

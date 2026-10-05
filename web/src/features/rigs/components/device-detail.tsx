import { useState } from "react"
import { LuPlugZap, LuSlidersHorizontal, LuVideo } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Panel } from "@/components/layout/page-layout"
import { DetailList } from "@/components/common/detail-list"
import { StatusDot } from "@/components/common/status-dot"
import { CameraPreview } from "@/components/robot/camera-preview"
import { usePorts, useTestDevice } from "@/api/devices"
import type { Device } from "@/domain/device"
import { isArm } from "@/domain/device"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

import { HEALTH_TONE, rateClass, rateText, TYPE_LABEL } from "../lib"
import { CalibrationDialog } from "./calibration-dialog"
import { PortDialog } from "./port-dialog"

/** Selected device: port, connection test, calibration and streams */
export function DeviceDetail({ device }: { device: Device }) {
  const test = useTestDevice()
  const portsQuery = usePorts()
  const [calibrating, setCalibrating] = useState(false)
  const [picking, setPicking] = useState(false)
  // Device id whose live preview is shown (resets when another device is selected)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const preview = previewId === device.id
  const port = portsQuery.data?.find((p) => p.path === device.port || p.device === device.port)
  const testing = test.isPending && test.variables === device.id
  const busy = device.calibration.note === "Calibrating…"
  const info = [
    { k: "Type", v: TYPE_LABEL[device.type] },
    {
      k: "Calibration",
      v: device.calibration.done ? device.calibration.note : <span className="text-warn">{device.calibration.note}</span>,
    },
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
        <div className="grid gap-1.5">
          <span className="text-xs text-muted-foreground">Port</span>
          <div className="flex items-center justify-between gap-3">
            <div className="grid min-w-0 gap-0.5 text-[13px]">
              {port ? (
                <span className="truncate">
                  {port.device} · {port.label || "USB device"}
                </span>
              ) : (
                <span className="truncate text-warn">{portsQuery.isPending ? device.port : `${device.port} (not found)`}</span>
              )}
              {port && (
                <span className="truncate text-xs text-muted-foreground" title={port.path}>
                  {port.path}
                </span>
              )}
            </div>
            <Button variant="outline" size="sm" disabled={busy || preview} onClick={() => setPicking(true)}>
              Change…
            </Button>
          </div>
        </div>

        {/* The test opens the port once (LeRobot); health and stats come from its result */}
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={testing || busy || preview} onClick={() => test.mutate(device.id)}>
              <LuPlugZap />
              {testing ? "Testing…" : "Test connection"}
            </Button>
            {device.type === "camera" && (
              <Button
                variant="outline"
                size="sm"
                aria-pressed={preview}
                disabled={testing || !port}
                onClick={() => setPreviewId(preview ? null : device.id)}
              >
                <LuVideo />
                {preview ? "Hide preview" : "Preview"}
              </Button>
            )}
            {isArm(device) && (
              <Button variant="outline" size="sm" disabled={testing} onClick={() => setCalibrating(true)}>
                <LuSlidersHorizontal />
                {busy ? "Calibrating…" : "Calibrate"}
              </Button>
            )}
          </div>
          {device.check ? (
            <div className="grid gap-0.5">
              <StatusDot tone={device.check.ok ? (device.health === "ok" ? "ok" : "warn") : "bad"} className="text-[13px]">
                <span className="min-w-0 [overflow-wrap:anywhere]">{device.check.message}</span>
              </StatusDot>
              <span className="pl-3 text-xs text-muted-foreground tabular-nums">Tested {formatDateTime(device.check.at)}</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">포트를 고른 뒤 Test connection 으로 연결 상태를 확인하세요.</span>
          )}
          {test.isError && test.variables === device.id && <span className="text-[13px] text-bad">{test.error.message}</span>}
          {/* A camera has one reader: the preview holds it, so testing waits until it is hidden */}
          {preview && port && (
            <>
              <CameraPreview path={port.path} />
              <span className="text-xs text-muted-foreground">미리보기가 카메라를 사용 중입니다. 테스트하려면 미리보기를 닫으세요.</span>
            </>
          )}
        </div>

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
      <PortDialog key={`port-${device.id}`} device={device} open={picking} onOpenChange={setPicking} />
      {isArm(device) && (
        <CalibrationDialog key={device.id} device={device} active={busy} open={calibrating} onOpenChange={setCalibrating} />
      )}
    </Panel>
  )
}

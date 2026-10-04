import { useState } from "react"
import { LuRefreshCw } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { EmptyState } from "@/components/common/empty-state"
import { ErrorNote, LoadingNote } from "@/components/common/query-state"
import { usePorts, useSetDevicePort } from "@/api/devices"
import type { Device, Port } from "@/domain/device"
import { portKind } from "@/domain/device"
import { cn } from "@/lib/utils"

import { CameraPreview } from "./camera-preview"

/** Picks a device's port from the scanned ports: a list for serial ports, live previews for cameras */
export function PortDialog({ device, open, onOpenChange }: { device: Device; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={portKind(device) === "video" ? "sm:max-w-3xl" : "sm:max-w-xl"}>
        {/* Mounted only while open: previews hold their cameras */}
        {open && <PortPicker device={device} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function PortPicker({ device, onDone }: { device: Device; onDone: () => void }) {
  const portsQuery = usePorts()
  const setPort = useSetDevicePort()
  const kind = portKind(device)
  const ports = (portsQuery.data ?? []).filter((p) => p.kind === kind)
  const current = ports.find((p) => p.path === device.port || p.device === device.port)
  const [picked, setPicked] = useState<string | undefined>(current?.path)
  const selected = picked ?? current?.path

  const save = () => {
    if (!selected || selected === device.port) return onDone()
    setPort.mutate({ id: device.id, port: selected }, { onSuccess: onDone })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{device.name} port</DialogTitle>
        <DialogDescription>
          {kind === "video" ? "미리보기를 보고 이 장치에 해당하는 카메라를 고르세요." : "이 장치가 연결된 시리얼 포트를 고르세요."} 선택한
          포트는 rig 파일에 바로 저장됩니다.
        </DialogDescription>
      </DialogHeader>

      <div className="flex items-center justify-between gap-3 text-[13px]">
        <span className="min-w-0 truncate text-muted-foreground" title={device.port}>
          Current:{" "}
          {current ? `${current.device} · ${current.label || "USB device"}` : <span className="text-warn">{device.port} (not found)</span>}
        </span>
        <Button variant="outline" size="sm" disabled={portsQuery.isFetching} onClick={() => void portsQuery.refetch()}>
          <LuRefreshCw />
          Rescan
        </Button>
      </div>

      <div className="max-h-[60vh] min-h-0 overflow-y-auto">
        {portsQuery.isPending ? (
          <LoadingNote />
        ) : portsQuery.isError ? (
          <ErrorNote error={portsQuery.error} onRetry={() => void portsQuery.refetch()} />
        ) : ports.length === 0 ? (
          <EmptyState>연결된 {kind === "video" ? "카메라" : "시리얼 장치"}가 없습니다. USB 를 연결하고 Rescan 을 누르세요.</EmptyState>
        ) : kind === "video" ? (
          <ul className="grid grid-cols-2 gap-3">
            {ports.map((p) => (
              <li key={p.path}>
                <button
                  type="button"
                  aria-pressed={selected === p.path}
                  onClick={() => setPicked(p.path)}
                  className={cn(
                    "grid w-full gap-2 rounded-lg border p-2 text-left transition-colors hover:bg-accent/60",
                    selected === p.path && "border-foreground bg-accent hover:bg-accent",
                  )}
                >
                  <CameraPreview path={p.path} />
                  <PortText port={p} deviceId={device.id} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="divide-y rounded-md border">
            {ports.map((p) => (
              <li key={p.path}>
                <button
                  type="button"
                  aria-pressed={selected === p.path}
                  onClick={() => setPicked(p.path)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/60",
                    selected === p.path && "bg-accent hover:bg-accent",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn("size-3.5 shrink-0 rounded-full border", selected === p.path && "border-4 border-foreground")}
                  />
                  <PortText port={p} deviceId={device.id} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ErrorNote error={setPort.error} />
      <DialogFooter>
        <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
        <Button disabled={!selected || setPort.isPending} onClick={save}>
          {setPort.isPending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </>
  )
}

function PortText({ port, deviceId }: { port: Port; deviceId: string }) {
  const others = port.usedBy.filter((id) => id !== deviceId)
  return (
    <span className="grid min-w-0 gap-0.5 text-[13px]">
      <span className="truncate">
        {port.device} · {port.label || "USB device"}
        {others.length > 0 && <span className="text-warn"> · used by {others.join(", ")}</span>}
      </span>
      <span className="truncate text-xs text-muted-foreground" title={port.path}>
        {port.path}
      </span>
    </span>
  )
}

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { usePorts, useSetDevicePort } from "@/api/devices"
import type { Device } from "@/domain/device"
import { portKind } from "@/domain/device"

/** Port picker over the ports scanned on the station (serial for arms, video for cameras) */
export function PortSelect({ device }: { device: Device }) {
  const portsQuery = usePorts()
  const setPort = useSetDevicePort()
  const ports = (portsQuery.data ?? []).filter((p) => p.kind === portKind(device))
  const current = ports.find((p) => p.path === device.port || p.device === device.port)
  const value = current?.path ?? device.port
  const labelOf = (path: string) => {
    const p = ports.find((x) => x.path === path)
    return p ? `${p.device} · ${p.label || "USB device"}` : `${path} (not found)`
  }

  return (
    <div className="grid gap-1.5">
      <Select
        value={value}
        disabled={setPort.isPending}
        onValueChange={(v) => v && v !== device.port && setPort.mutate({ id: device.id, port: v as string })}
      >
        <SelectTrigger aria-label="Port" className="h-9 w-full text-[13px]">
          <SelectValue>{(v: string) => labelOf(v)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {!current && (
            <SelectItem value={device.port} className="text-[13px] text-muted-foreground">
              {device.port} (not found)
            </SelectItem>
          )}
          {ports.map((p) => {
            const others = p.usedBy.filter((id) => id !== device.id)
            return (
              <SelectItem key={p.path} value={p.path} className="text-[13px]">
                <span className="grid max-w-64 min-w-0 gap-0.5">
                  <span className="truncate">
                    {p.device} · {p.label || "USB device"}
                    {others.length > 0 && <span className="text-warn"> · used by {others.join(", ")}</span>}
                  </span>
                  <span className="truncate text-xs text-muted-foreground" title={p.path}>
                    {p.path}
                  </span>
                </span>
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
      {portsQuery.isSuccess && ports.length === 0 && (
        <span className="text-xs text-muted-foreground">
          연결된 {portKind(device) === "video" ? "카메라" : "시리얼 장치"}가 없습니다. USB 를 연결하고 Rescan ports 를 누르세요.
        </span>
      )}
      {setPort.isError && <span className="text-[13px] text-bad">{setPort.error.message}</span>}
    </div>
  )
}

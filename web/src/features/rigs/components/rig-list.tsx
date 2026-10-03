import { LuPlus } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Panel } from "@/components/layout/page-layout"
import { StatusDot } from "@/components/common/status-dot"
import { useDevices } from "@/api/devices"
import { useRigs } from "@/api/rigs"
import { cn } from "@/lib/utils"

import { HEALTH_TONE, rigDeviceIds, rigHealth } from "../lib"
import { ErrorNote, LoadingNote } from "@/components/common/query-state"

export function RigList({ selectedId, onSelect }: { selectedId: string | undefined; onSelect: (id: string) => void }) {
  const rigsQuery = useRigs()
  const rigs = rigsQuery.data ?? []
  const allDevices = useDevices().data

  return (
    <Panel
      className="gap-2 p-3"
      title={
        <span className="flex items-baseline gap-1.5 px-2 text-[13px] font-medium">
          Rigs
          <span className="font-normal text-muted-foreground tabular-nums">{rigsQuery.data ? rigs.length : ""}</span>
        </span>
      }
      action={
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Add rig"
          title="Rig 설정은 v1 에서 읽기 전용입니다"
          className="text-muted-foreground"
          disabled
        >
          <LuPlus />
        </Button>
      }
    >
      {rigsQuery.isError && <ErrorNote error={rigsQuery.error} onRetry={() => void rigsQuery.refetch()} />}
      <ul className="grid min-h-0 flex-1 content-start gap-0.5 overflow-y-auto">
        {rigsQuery.isPending && (
          <li>
            <LoadingNote />
          </li>
        )}
        {rigs.map((r) => {
          const ids = rigDeviceIds(r)
          const devices = allDevices?.filter((d) => ids.includes(d.id))
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
                  <StatusDot tone={devices ? HEALTH_TONE[rigHealth(devices)] : "muted"} />
                  <span className={cn("truncate text-[13px]", selected ? "font-medium" : "font-normal")}>{r.name}</span>
                </span>
                <span className="truncate pl-3.5 text-xs text-muted-foreground">
                  {r.master} → {r.slave}
                </span>
                <span className="pl-3.5 text-[11px] text-muted-foreground/80 tabular-nums">
                  {r.robots.length} robot · {r.devices.length} device · {r.cameras.length} cam · {r.joints.length} DoF
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

import type { UseQueryResult } from "@tanstack/react-query"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Panel } from "@/components/layout/page-layout"
import { useRigYaml } from "@/api/rigs"
import type { Device } from "@/domain/device"
import type { Rig, rigGroups } from "@/domain/rig"

import { DeviceRow } from "./device-row"
import { ErrorNote, LoadingNote } from "@/components/common/query-state"

type Props = {
  rig: Rig
  groups: ReturnType<typeof rigGroups>
  group: string
  groupDevices: Device[]
  devicesQuery: UseQueryResult<Device[]>
  selectedId?: string
  onGroupChange: (key: string) => void
  onSelectDevice: (id: string) => void
}

/** Device list and config file for the selected rig */
export function RigDevices({ rig, groups, group, groupDevices, devicesQuery, selectedId, onGroupChange, onSelectDevice }: Props) {
  const yaml = useRigYaml(group === "config" ? rig.id : undefined)

  return (
    <Panel
      className="@container"
      title={rig.name}
      action={
        <span className="text-[13px] text-muted-foreground tabular-nums">
          {rig.joints.length} DoF · {rig.targetHz.action} Hz · {rig.targetHz.video} fps
        </span>
      }
    >
      {/* Split the rig's devices into Robot / Device / Camera tabs */}
      <Tabs value={group} onValueChange={(v) => onGroupChange(String(v))} className="min-h-0 flex-1">
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
        {/* Rig config file: records the Robot / Device / Camera setup */}
        <TabsContent value="config" className="min-h-0 flex-1 overflow-y-auto">
          {yaml.isError ? (
            <ErrorNote error={yaml.error} onRetry={() => void yaml.refetch()} />
          ) : yaml.data === undefined ? (
            <LoadingNote />
          ) : (
            <pre className="rounded-md bg-muted p-4 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">{yaml.data}</pre>
          )}
        </TabsContent>
        {groups.map((g) => (
          <TabsContent key={g.key} value={g.key} className="-mx-2 min-h-0 flex-1 overflow-y-auto">
            {devicesQuery.isError ? (
              <ErrorNote className="mx-2" error={devicesQuery.error} onRetry={() => void devicesQuery.refetch()} />
            ) : devicesQuery.isPending ? (
              <LoadingNote />
            ) : groupDevices.length === 0 ? (
              <p className="px-2 py-6 text-center text-[13px] text-muted-foreground">이 Rig 에 {g.label} 장치가 없습니다.</p>
            ) : (
              <ul className="grid gap-0.5">
                {groupDevices.map((d) => (
                  <DeviceRow key={d.id} device={d} selected={d.id === selectedId} onSelect={() => onSelectDevice(d.id)} />
                ))}
              </ul>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </Panel>
  )
}

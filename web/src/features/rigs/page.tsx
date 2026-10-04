import { useState } from "react"
import { LuBot, LuBoxes, LuCable, LuCamera, LuGamepad2, LuPlus, LuRefreshCw } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Page, Panel } from "@/components/layout/page-layout"
import { EmptyState } from "@/components/common/empty-state"
import { ErrorNote, LoadingNote } from "@/components/common/query-state"
import { StatStrip } from "@/components/common/stat-strip"
import { usePorts } from "@/api/devices"

import { DeviceDetail } from "./components/device-detail"
import { RigDevices } from "./components/rig-devices"
import { RigList } from "./components/rig-list"
import { TeleopDialog } from "./components/teleop-dialog"
import { useRigSelection } from "./hooks/use-rig-selection"

export function RigsPage() {
  const { rigsQuery, devicesQuery, rig, groups, group, groupDevices, selected, selectRig, selectGroup, selectDevice } = useRigSelection()
  const portsQuery = usePorts()
  const [teleop, setTeleop] = useState(false)

  const rigs = rigsQuery.data ?? []
  const count = (n: number) => (rigsQuery.data ? n : "—")

  // Devices are only plugged in over USB for testing, so show registered counts from the rig config instead of connection state
  const stats = [
    { label: "Rigs", value: count(rigs.length), icon: LuBoxes },
    { label: "Robots", value: count(rigs.reduce((n, r) => n + r.robots.length, 0)), icon: LuBot },
    { label: "Devices", value: count(rigs.reduce((n, r) => n + r.devices.length, 0)), icon: LuCable },
    { label: "Cameras", value: count(rigs.reduce((n, r) => n + r.cameras.length, 0)), icon: LuCamera },
  ]

  return (
    <Page
      fit
      title="Rigs"
      description="Rig 별로 Robot · Device · Camera 구성을 등록하고 관리합니다."
      actions={
        <>
          {/* Scans serial / video ports again (the port pickers list them) and reloads devices */}
          <Button
            variant="outline"
            size="lg"
            disabled={portsQuery.isFetching || devicesQuery.isFetching}
            onClick={() => {
              void portsQuery.refetch()
              void devicesQuery.refetch()
            }}
          >
            <LuRefreshCw />
            Rescan ports
          </Button>
          <Button variant="outline" size="lg" disabled={!rig} onClick={() => setTeleop(true)}>
            <LuGamepad2 />
            Test teleoperation
          </Button>
          <Button size="lg" disabled title="Rig 설정은 v1 에서 읽기 전용입니다">
            <LuPlus />
            Add device
          </Button>
        </>
      }
    >
      <StatStrip items={stats} />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,4fr)_minmax(0,3fr)]">
        <RigList selectedId={rig?.id} onSelect={selectRig} />
        {rig ? (
          <RigDevices
            rig={rig}
            groups={groups}
            group={group}
            groupDevices={groupDevices}
            devicesQuery={devicesQuery}
            selectedId={selected?.id}
            onGroupChange={selectGroup}
            onSelectDevice={selectDevice}
          />
        ) : (
          <Panel>
            {rigsQuery.isError ? (
              <ErrorNote error={rigsQuery.error} onRetry={() => void rigsQuery.refetch()} />
            ) : rigsQuery.data ? (
              <EmptyState>등록된 Rig 가 없습니다. data/rigs 에 rig 파일을 추가하세요.</EmptyState>
            ) : (
              <LoadingNote />
            )}
          </Panel>
        )}
        {selected ? <DeviceDetail device={selected} /> : <Panel>{devicesQuery.isPending && <LoadingNote />}</Panel>}
      </div>
      {rig && <TeleopDialog key={rig.id} rig={rig} open={teleop} onOpenChange={setTeleop} />}
    </Page>
  )
}

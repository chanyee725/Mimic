import { LuBot, LuBoxes, LuCable, LuCamera, LuPlus, LuRefreshCw } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Page, Panel } from "@/components/layout/page-layout"
import { StatStrip } from "@/components/common/stat-strip"

import { DeviceDetail } from "./components/device-detail"
import { Loading, QueryError } from "./components/query-state"
import { RigDevices } from "./components/rig-devices"
import { RigList } from "./components/rig-list"
import { useRigSelection } from "./hooks/use-rig-selection"

export function RigsPage() {
  const { rigsQuery, devicesQuery, rig, groups, group, groupDevices, selected, selectRig, selectGroup, selectDevice } = useRigSelection()

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
          {/* No port scan endpoint yet: reload rigs and devices (live health arrives as device.updated events) */}
          <Button
            variant="outline"
            size="lg"
            disabled={rigsQuery.isFetching || devicesQuery.isFetching}
            onClick={() => {
              void rigsQuery.refetch()
              void devicesQuery.refetch()
            }}
          >
            <LuRefreshCw />
            Rescan ports
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
          <Panel>{rigsQuery.isError ? <QueryError error={rigsQuery.error} onRetry={() => void rigsQuery.refetch()} /> : <Loading />}</Panel>
        )}
        {selected ? <DeviceDetail device={selected} /> : <Panel>{devicesQuery.isPending && <Loading />}</Panel>}
      </div>
    </Page>
  )
}

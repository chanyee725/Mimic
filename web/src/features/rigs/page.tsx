import { LuBot, LuBoxes, LuCable, LuCamera, LuPlus, LuRefreshCw } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Page } from "@/components/app/page"
import { StatStrip } from "@/components/app/stat-strip"
import { RIGS } from "@/dummy/rigs"

import { DeviceDetail } from "./components/device-detail"
import { RigDevices } from "./components/rig-devices"
import { RigList } from "./components/rig-list"
import { useRigSelection } from "./hooks/use-rig-selection"

export function RigsPage() {
  const { rig, groups, group, groupDevices, selected, selectRig, selectGroup, selectDevice } = useRigSelection()

  // 장치는 테스트할 때만 USB 로 연결되므로 연결 상태 대신 Rig 설정 기준 등록 현황을 보여준다
  const stats = [
    { label: "Rigs", value: RIGS.length, icon: LuBoxes },
    { label: "Robots", value: RIGS.reduce((n, r) => n + r.robots.length, 0), icon: LuBot },
    { label: "Devices", value: RIGS.reduce((n, r) => n + r.devices.length, 0), icon: LuCable },
    { label: "Cameras", value: RIGS.reduce((n, r) => n + r.cameras.length, 0), icon: LuCamera },
  ]

  return (
    <Page
      fit
      title="Rigs"
      description="Rig 별로 Robot · Device · Camera 구성을 등록하고 관리합니다."
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
        <RigDevices
          rig={rig}
          groups={groups}
          group={group}
          groupDevices={groupDevices}
          selectedId={selected?.id}
          onGroupChange={selectGroup}
          onSelectDevice={selectDevice}
        />
        {selected && <DeviceDetail device={selected} />}
      </div>
    </Page>
  )
}

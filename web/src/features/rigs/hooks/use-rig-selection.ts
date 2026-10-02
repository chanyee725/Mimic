import { useState } from "react"

import { devicesOf } from "@/dummy/devices"
import { getRig, rigGroups, RIGS } from "@/dummy/rigs"

/** 선택한 Rig · 장치 그룹(탭) · 장치. Rig 나 그룹을 바꾸면 첫 장치를 고른다 */
export function useRigSelection() {
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

  return { rig, groups, group, groupDevices, selected, selectRig, selectGroup, selectDevice: setSelectedId }
}

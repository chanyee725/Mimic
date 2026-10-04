import { useEffect, useRef, useState } from "react"

import { useRigDevices } from "@/api/devices"
import { useRigs, useTestRig } from "@/api/rigs"
import { rigGroups } from "@/domain/rig"

/** Selected rig, device group (tab) and device. Changing the rig or group selects its first device */
export function useRigSelection() {
  const rigsQuery = useRigs()
  const rigs = rigsQuery.data ?? []
  const [rigId, setRigId] = useState<string | undefined>()
  const rig = rigs.find((r) => r.id === rigId) ?? rigs[0]
  const devicesQuery = useRigDevices(rig?.id)
  const devices = devicesQuery.data ?? []
  const groups = rig ? rigGroups(rig) : []
  const [group, setGroup] = useState<string>("robot")
  const groupIds = groups.find((g) => g.key === group)?.ids ?? []
  const groupDevices = devices.filter((d) => groupIds.includes(d.id))
  const [selectedId, setSelectedId] = useState<string | undefined>()

  // The rig files hold every port: test each rig's devices the first time it is shown
  const testRig = useTestRig()
  const tested = useRef(new Set<string>())
  const { mutate } = testRig
  const shownId = rig?.id
  useEffect(() => {
    if (!shownId || tested.current.has(shownId)) return
    tested.current.add(shownId)
    mutate(shownId)
  }, [shownId, mutate])
  const selected = devices.find((d) => d.id === selectedId) ?? groupDevices[0] ?? devices[0]

  const selectRig = (id: string) => {
    setRigId(id)
    setGroup("robot")
    setSelectedId(undefined)
  }
  const selectGroup = (key: string) => {
    setGroup(key)
    const first = groups.find((g) => g.key === key)?.ids[0]
    if (first) setSelectedId(first)
  }

  return {
    rigsQuery,
    devicesQuery,
    rig,
    testRig,
    groups,
    group,
    groupDevices,
    selected,
    selectRig,
    selectGroup,
    selectDevice: setSelectedId,
  }
}

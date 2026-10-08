import { useState } from "react"

import { useDevices, useTestDevice } from "@/api/devices"
import { useSimTeleop, useStartSimTeleop, useStopSimTeleop } from "@/api/simulation"
import type { Device, DeviceCheck } from "@/domain/device"
import { isSimTeleopActive, type SimAsset } from "@/domain/simulation"

/**
 * Teleoperation dialog state: pick a leader, test it, start, follow the session, stop.
 * Start needs a successful connection test of the picked leader made in this dialog.
 */
export function useTeleopFlow(robot: SimAsset, open: boolean) {
  const devices = useDevices()
  const leaders = (devices.data ?? []).filter((d) => d.type === "teleop")
  // A leader drives the robot when its LeRobot type is one the robot lists (so101_leader → so101_follower)
  const fits = (d: Device) => d.driver !== null && robot.teleop.includes(d.driver)
  const [picked, setPicked] = useState<string>()
  const leader = leaders.find((d) => d.id === picked) ?? leaders.find(fits) ?? leaders[0]

  const test = useTestDevice()
  // Results of the tests run in this dialog, by device id
  const [checks, setChecks] = useState<Record<string, DeviceCheck>>({})
  const runTest = (id: string) =>
    test.mutate(id, { onSuccess: (d) => d.check && setChecks((c) => ({ ...c, [id]: d.check as DeviceCheck })) })
  const check = leader ? checks[leader.id] : undefined

  const session = useSimTeleop(open)
  const start = useStartSimTeleop()
  const stop = useStopSimTeleop()
  const current = session.data ?? null
  const active = isSimTeleopActive(current)
  // A running session for another robot blocks Start; only Stop is offered for it
  const other = active && current?.robotId !== robot.id ? current : null

  const canStart = !!leader && fits(leader) && check?.ok === true && !active && !start.isPending

  return {
    devices,
    leaders,
    leader,
    fits,
    pick: setPicked,
    test,
    testing: test.isPending && test.variables === leader?.id,
    runTest,
    check,
    session,
    current,
    active,
    other,
    start: () => leader && start.mutate({ robotId: robot.id, deviceId: leader.id }),
    starting: start.isPending,
    stop: () => stop.mutate(),
    stopping: stop.isPending,
    canStart,
    error: start.error ?? stop.error ?? test.error,
    reset: () => {
      start.reset()
      stop.reset()
      test.reset()
    },
  }
}

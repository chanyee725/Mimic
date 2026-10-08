import { useState } from "react"

import { useDevices, useTestDevice } from "@/api/devices"
import { useCaptureLeaderRest, useSimTeleop, useStartSimTeleop, useStopSimTeleop } from "@/api/simulation"
import type { Device, DeviceCheck } from "@/domain/device"
import { isSimTeleopActive, SIM_KEYBOARD, type SimAsset } from "@/domain/simulation"

/**
 * Teleoperation dialog state: pick a leader (or the keyboard), test it, start, follow the session, stop.
 * Start needs a successful connection test of the picked leader made in this dialog; the keyboard needs none.
 */
export function useTeleopFlow(robot: SimAsset, open: boolean) {
  const devices = useDevices()
  const leaders = (devices.data ?? []).filter((d) => d.type === "teleop")
  // A leader drives the robot when its LeRobot type is one the robot lists (so101_leader → so101_follower)
  const fits = (d: Device) => d.driver !== null && robot.teleop.includes(d.driver)
  // Default: a fitting leader, else the keyboard (e.g. the xArm7, which no leader type drives)
  const [picked, setPicked] = useState<string>()
  const fitting = leaders.find(fits)
  const keyboard = picked === SIM_KEYBOARD || (picked === undefined && !fitting)
  const leader = keyboard ? undefined : (leaders.find((d) => d.id === picked) ?? fitting ?? leaders[0])

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

  const canStart = !active && !start.isPending && (keyboard || (!!leader && fits(leader) && check?.ok === true))

  // Leader rest: from the leader driving this robot, or from the picked leader once it tested fine
  const capture = useCaptureLeaderRest()
  const poseDevice = active
    ? current?.robotId === robot.id && current.state === "running" && current.deviceId !== SIM_KEYBOARD
      ? current.deviceId
      : undefined
    : canStart && !keyboard
      ? leader?.id
      : undefined

  return {
    devices,
    leaders,
    leader,
    keyboard,
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
    start: () => {
      const deviceId = keyboard ? SIM_KEYBOARD : leader?.id
      if (deviceId) start.mutate({ robotId: robot.id, deviceId })
    },
    starting: start.isPending,
    stop: () => stop.mutate(),
    stopping: stop.isPending,
    canStart,
    capture: () => poseDevice && capture.mutate({ robotId: robot.id, deviceId: poseDevice }),
    capturing: capture.isPending,
    canCapture: !!poseDevice && !capture.isPending,
    /** The pose just saved in this dialog */
    captured: capture.data?.leaderRest ?? null,
    error: start.error ?? stop.error ?? test.error ?? capture.error,
    reset: () => {
      start.reset()
      stop.reset()
      capture.reset()
      test.reset()
    },
  }
}

export type RigCamera = {
  id: string // device id (@/dummy/devices)
  key: string // camera key toggled per task
  name: string
  feature: string // LeRobot feature key
  resolution: string
  fps: number
  defaultOn: boolean
}

export type Rig = {
  id: string
  name: string
  master: string // display name: teleop (leader)
  slave: string // display name: robot (follower)
  robots: string[] // robot device ids (slave / follower)
  devices: string[] // input device ids (master / leader, …)
  cameras: RigCamera[]
  joints: string[] // action space, in action vector order
  targetHz: { action: number; video: number }
  actionHzOptions: number[]
  videoFpsOptions: number[]
}

/** Groups on the Rigs page (from the rig config) */
export type RigGroupKey = "robot" | "device" | "camera"

export function rigGroups(rig: Rig): { key: RigGroupKey; label: string; ids: string[] }[] {
  return [
    { key: "robot", label: "Robot", ids: rig.robots },
    { key: "device", label: "Device", ids: rig.devices },
    { key: "camera", label: "Camera", ids: rig.cameras.map((c) => c.id) },
  ]
}

/** Fill a task's rig-related fields from the rig defaults */
export const rigDefaults = (rig: Rig) => ({
  rigId: rig.id,
  actionHz: rig.targetHz.action,
  videoFps: rig.targetHz.video,
  cameras: rig.cameras.filter((c) => c.defaultOn).map((c) => c.key),
})

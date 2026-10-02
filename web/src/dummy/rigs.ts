// Rig config: the set of equipment that makes up one capture unit.
// This config decides which devices count as Robot / Device / Camera;
// live state (health, measured rates, …) is looked up by device id in @/dummy/devices.

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

const SO101_ARM = ["shoulder_pan", "shoulder_lift", "elbow_flex", "wrist_flex", "wrist_roll", "gripper"]

const camera = (id: string, key: string, name: string, defaultOn = true): RigCamera => ({
  id,
  key,
  name,
  feature: `observation.images.${key}`,
  resolution: "640×480",
  fps: 30,
  defaultOn,
})

export const RIGS: Rig[] = [
  {
    id: "so101-kit",
    name: "SO-101 Kit",
    master: "SO-101 Leader",
    slave: "SO-101 Follower",
    robots: ["follower"],
    devices: ["leader"],
    cameras: [camera("top", "top", "Top camera"), camera("wrist", "wrist", "Wrist camera")],
    joints: SO101_ARM,
    targetHz: { action: 60, video: 30 },
    actionHzOptions: [30, 60],
    videoFpsOptions: [15, 30],
  },
  {
    id: "so101-bimanual-kit",
    name: "SO-101 Bimanual Kit",
    master: "SO-101 Leader ×2",
    slave: "SO-101 Follower ×2",
    robots: ["bi-follower-l", "bi-follower-r"],
    devices: ["bi-leader-l", "bi-leader-r"],
    cameras: [
      camera("bi-cam-top", "top", "Top camera"),
      camera("bi-cam-wrist-l", "left_wrist", "Left wrist camera"),
      camera("bi-cam-wrist-r", "right_wrist", "Right wrist camera"),
    ],
    joints: [...SO101_ARM.map((j) => `left_${j}`), ...SO101_ARM.map((j) => `right_${j}`)],
    targetHz: { action: 60, video: 30 },
    actionHzOptions: [30, 60],
    videoFpsOptions: [15, 30],
  },
]

export const getRig = (id: string) => RIGS.find((r) => r.id === id) ?? RIGS[0]

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

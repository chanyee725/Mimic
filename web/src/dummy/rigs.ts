// Rig config: the set of equipment that makes up one capture unit.
// This config decides which devices count as Robot / Device / Camera;
// live state (health, measured rates, …) is looked up by device id in @/dummy/devices.

import type { RigCamera, Rig } from "@/domain/rig"

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

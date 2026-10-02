// Rig 설정: 데이터 취득 단위가 되는 장비 묶음.
// 어떤 장치가 Robot / Device / Camera 로 속하는지는 이 설정이 기준이 되며,
// 실제 연결 상태(health, 측정 주기 등)는 @/dummy/devices 에서 장치 id 로 찾는다.

export type RigCamera = {
  id: string // 장치 id (@/dummy/devices)
  key: string // Task 에서 켜고 끄는 카메라 키
  name: string
  feature: string // LeRobot feature key
  resolution: string
  fps: number
  defaultOn: boolean
}

export type Rig = {
  id: string
  name: string
  master: string // 표시용: teleop (leader)
  slave: string // 표시용: robot (follower)
  robots: string[] // Robot 장치 id (slave / follower)
  devices: string[] // Device 장치 id (master / leader 등 입력 장치)
  cameras: RigCamera[]
  joints: string[] // action space, 순서 = action 벡터 순서
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

/** Rigs 화면의 구분 (Rig 설정 기준) */
export type RigGroupKey = "robot" | "device" | "camera"

export function rigGroups(rig: Rig): { key: RigGroupKey; label: string; ids: string[] }[] {
  return [
    { key: "robot", label: "Robot", ids: rig.robots },
    { key: "device", label: "Device", ids: rig.devices },
    { key: "camera", label: "Camera", ids: rig.cameras.map((c) => c.id) },
  ]
}

/** Rig 기본값으로 Task 의 rig 관련 필드를 채운다 */
export const rigDefaults = (rig: Rig) => ({
  rigId: rig.id,
  actionHz: rig.targetHz.action,
  videoFps: rig.targetHz.video,
  cameras: rig.cameras.filter((c) => c.defaultOn).map((c) => c.key),
})

// Rig: 데이터 취득 단위가 되는 장비 묶음 (Master/Slave 암 + 카메라 + 주기 설정).
// Task 는 Rig 를 선택해서 이 설정을 불러온다.

export type RigCamera = {
  key: string
  name: string
  feature: string // LeRobot feature key
  resolution: string
  fps: number
  defaultOn: boolean
}

export type Rig = {
  id: string
  name: string
  master: string // teleop (leader)
  slave: string // robot (follower)
  joints: string[] // action space, 순서 = action 벡터 순서
  targetHz: { action: number; video: number }
  actionHzOptions: number[]
  videoFpsOptions: number[]
  cameras: RigCamera[]
}

const SO101_ARM = ["shoulder_pan", "shoulder_lift", "elbow_flex", "wrist_flex", "wrist_roll", "gripper"]

const camera = (key: string, name: string, defaultOn: boolean): RigCamera => ({
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
    joints: SO101_ARM,
    targetHz: { action: 60, video: 30 },
    actionHzOptions: [30, 60],
    videoFpsOptions: [15, 30],
    cameras: [camera("front", "Front camera", true), camera("wrist", "Wrist camera", true), camera("top", "Top camera", false)],
  },
  {
    id: "so101-bimanual-kit",
    name: "SO-101 Bimanual Kit",
    master: "SO-101 Leader ×2",
    slave: "SO-101 Follower ×2",
    joints: [...SO101_ARM.map((j) => `left_${j}`), ...SO101_ARM.map((j) => `right_${j}`)],
    targetHz: { action: 60, video: 30 },
    actionHzOptions: [30, 60],
    videoFpsOptions: [15, 30],
    cameras: [
      camera("top", "Top camera", true),
      camera("left_wrist", "Left wrist camera", true),
      camera("right_wrist", "Right wrist camera", true),
    ],
  },
]

export const getRig = (id: string) => RIGS.find((r) => r.id === id) ?? RIGS[0]

/** Rig 기본값으로 Task 의 rig 관련 필드를 채운다 */
export const rigDefaults = (rig: Rig) => ({
  rigId: rig.id,
  actionHz: rig.targetHz.action,
  videoFps: rig.targetHz.video,
  cameras: rig.cameras.filter((c) => c.defaultOn).map((c) => c.key),
})

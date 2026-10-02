// SO-101 기준 상수. 백엔드 연결 전까지 UI 에서 사용하는 더미 값.

export const ACTION_HZ = 60
export const VIDEO_FPS = 30

export const SO101_JOINTS = [
  "shoulder_pan",
  "shoulder_lift",
  "elbow_flex",
  "wrist_flex",
  "wrist_roll",
  "gripper",
] as const

export const FINGERS = [
  { name: "Thumb", short: "T" },
  { name: "Index", short: "I" },
  { name: "Middle", short: "M" },
  { name: "Ring", short: "R" },
  { name: "Pinky", short: "P" },
] as const

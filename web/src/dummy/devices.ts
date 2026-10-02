import { getRig, rigGroups } from "@/dummy/rigs"

export type DeviceType = "robot" | "teleop" | "camera" | "glove" | "input"
export type Health = "ok" | "warn" | "off"

export type DeviceStream = {
  key: string
  shape: string
  targetHz: number | null // null = event 기반
  measuredHz: number | null
  unit: "Hz" | "fps"
}

export type Device = {
  id: string
  name: string
  type: DeviceType
  port: string
  health: Health
  calibration: { done: boolean; note: string }
  streams: DeviceStream[]
  stats: { label: string; value: string }[]
}

export const DEVICES: Device[] = [
  {
    id: "leader",
    name: "SO-101 Leader",
    type: "teleop",
    port: "/dev/so101_leader",
    health: "ok",
    calibration: { done: true, note: "Calibrated · 2026-09-28" },
    streams: [{ key: "action", shape: "[6]", targetHz: 60, measuredHz: 59.8, unit: "Hz" }],
    stats: [
      { label: "Max motor temp", value: "38°C" },
      { label: "Voltage", value: "12.1 V" },
      { label: "Bus latency", value: "2.1 ms" },
    ],
  },
  {
    id: "follower",
    name: "SO-101 Follower",
    type: "robot",
    port: "/dev/so101_follower",
    health: "warn",
    calibration: { done: true, note: "Calibrated · 2026-09-28" },
    streams: [{ key: "observation.state", shape: "[6]", targetHz: 60, measuredHz: 59.9, unit: "Hz" }],
    stats: [
      { label: "Max motor temp", value: "52°C" },
      { label: "Voltage", value: "12.1 V" },
      { label: "Bus latency", value: "2.3 ms" },
    ],
  },
  {
    id: "top",
    name: "Top camera",
    type: "camera",
    port: "/dev/cam_top",
    health: "ok",
    calibration: { done: true, note: "Intrinsics registered" },
    streams: [{ key: "images.top", shape: "480×640×3", targetHz: 30, measuredHz: 30.0, unit: "fps" }],
    stats: [
      { label: "Resolution", value: "640×480" },
      { label: "Exposure", value: "auto" },
      { label: "USB", value: "3.0" },
    ],
  },
  {
    id: "wrist",
    name: "Wrist camera",
    type: "camera",
    port: "/dev/cam_wrist",
    health: "warn",
    calibration: { done: true, note: "Intrinsics registered" },
    streams: [{ key: "images.wrist", shape: "480×640×3", targetHz: 30, measuredHz: 28.7, unit: "fps" }],
    stats: [
      { label: "Resolution", value: "640×480" },
      { label: "Exposure", value: "auto" },
      { label: "USB", value: "2.0" },
    ],
  },
]

const offlineArm = (id: string, name: string, type: DeviceType, key: string): Device => ({
  id,
  name,
  type,
  port: `/dev/${id.replaceAll("-", "_")}`,
  health: "off",
  calibration: { done: false, note: "Calibration required" },
  streams: [{ key, shape: "[6]", targetHz: 60, measuredHz: null, unit: "Hz" }],
  stats: [
    { label: "Max motor temp", value: "—" },
    { label: "Voltage", value: "—" },
    { label: "Bus latency", value: "—" },
  ],
})

const bimanualCamera = (id: string, name: string, key: string, health: Health): Device => ({
  id,
  name,
  type: "camera",
  port: `/dev/${id.replaceAll("-", "_")}`,
  health,
  calibration: { done: health !== "off", note: health === "off" ? "Not registered" : "Intrinsics registered" },
  streams: [{ key, shape: "480×640×3", targetHz: 30, measuredHz: health === "off" ? null : 30.0, unit: "fps" }],
  stats: [
    { label: "Resolution", value: "640×480" },
    { label: "Exposure", value: "auto" },
    { label: "USB", value: "3.0" },
  ],
})

DEVICES.push(
  offlineArm("bi-leader-l", "SO-101 Leader (L)", "teleop", "action.left"),
  offlineArm("bi-leader-r", "SO-101 Leader (R)", "teleop", "action.right"),
  offlineArm("bi-follower-l", "SO-101 Follower (L)", "robot", "observation.state.left"),
  offlineArm("bi-follower-r", "SO-101 Follower (R)", "robot", "observation.state.right"),
  bimanualCamera("bi-cam-top", "Top camera", "images.top", "ok"),
  bimanualCamera("bi-cam-wrist-l", "Left wrist camera", "images.left_wrist", "off"),
  bimanualCamera("bi-cam-wrist-r", "Right wrist camera", "images.right_wrist", "off"),
)

/** Rig 설정에 등록된 장치를 Robot → Device → Camera 순서로 돌려준다 */
export function devicesOf(rigId: string): Device[] {
  return rigGroups(getRig(rigId))
    .flatMap((g) => g.ids)
    .map((id) => DEVICES.find((d) => d.id === id))
    .filter((d): d is Device => Boolean(d))
}


export const STATION_WARNINGS = [
  "Wrist camera 28.7 fps (target 30)",
  "Follower wrist_roll motor 52°C",
]

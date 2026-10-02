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
    id: "front",
    name: "Front camera",
    type: "camera",
    port: "/dev/cam_front",
    health: "ok",
    calibration: { done: true, note: "Intrinsics registered" },
    streams: [{ key: "images.front", shape: "480×640×3", targetHz: 30, measuredHz: 30.0, unit: "fps" }],
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
  {
    id: "glove",
    name: "Data Glove (R)",
    type: "glove",
    port: "ble://glove-r",
    health: "off",
    calibration: { done: false, note: "Calibration required" },
    streams: [
      { key: "hand.imu", shape: "[16,7]", targetHz: 200, measuredHz: null, unit: "Hz" },
      { key: "hand.flex", shape: "[10]", targetHz: 100, measuredHz: null, unit: "Hz" },
      { key: "hand.tactile", shape: "[5,4,4]", targetHz: 100, measuredHz: null, unit: "Hz" },
    ],
    stats: [
      { label: "Battery", value: "—" },
      { label: "BLE RSSI", value: "—" },
      { label: "Firmware", value: "—" },
    ],
  },
  {
    id: "pedal",
    name: "Foot pedal",
    type: "input",
    port: "/dev/input/pedal",
    health: "ok",
    calibration: { done: true, note: "L Re-record · C Start/Stop · R Save" },
    streams: [{ key: "events", shape: "3 keys", targetHz: null, measuredHz: null, unit: "Hz" }],
    stats: [{ label: "Mapping", value: "3 keys" }],
  },
]

export const CALIBRATION_STEPS: Record<"arm" | "glove", string[]> = {
  arm: ["Check port · motor IDs", "Record middle pose", "Sweep full joint range", "Save · version"],
  glove: ["Flat hand", "Fist", "Thumb pinch", "IMU reference pose"],
}

export const STATION_WARNINGS = [
  "Wrist camera 28.7 fps (target 30)",
  "Follower wrist_roll motor 52°C",
]

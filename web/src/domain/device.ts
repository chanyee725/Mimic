export type DeviceType = "robot" | "teleop" | "camera" | "glove" | "input"

export type Health = "ok" | "warn" | "off"

export type DeviceStream = {
  key: string
  shape: string
  targetHz: number | null // null = event-based
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

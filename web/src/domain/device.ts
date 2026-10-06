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
  check: DeviceCheck | null
  simulated: boolean // a sim rig's robot or camera (no port, no calibration)
}

/** Last connection test (POST /devices/{id}/test) */
export type DeviceCheck = { ok: boolean; message: string; at: string }

export type PortKind = "serial" | "video"

/** A serial / video port found on the station */
export type Port = {
  path: string // stable path to store (/dev/serial/by-id/… when there is one)
  device: string // kernel node (/dev/ttyACM0)
  kind: PortKind
  label: string
  usedBy: string[] // device ids assigned to it
}

export type CalibrationStep = "center" | "range" | "done" | "failed"

export type MotorRange = { name: string; pos: number | null; min: number | null; max: number | null; fullTurn: boolean }

export type CalibrationSession = {
  deviceId: string
  step: CalibrationStep
  message: string
  motors: MotorRange[]
  file: string | null
  startedAt: string
}

/** Arms are calibrated on the station; cameras need none */
export const isArm = (d: Device) => d.type === "robot" || d.type === "teleop"

export const portKind = (d: Device): PortKind => (d.type === "camera" ? "video" : "serial")

export const isCalibrating = (s: CalibrationSession | undefined) => s?.step === "center" || s?.step === "range"

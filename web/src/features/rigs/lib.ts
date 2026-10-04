import type { Tone } from "@/components/common/status-dot"
import type { Device, DeviceStream, Health } from "@/domain/device"
import type { Rig } from "@/domain/rig"

export const HEALTH_TONE: Record<Health, Tone> = { ok: "ok", warn: "warn", off: "muted" }

export const TYPE_LABEL: Record<Device["type"], string> = {
  robot: "Robot (follower)",
  teleop: "Teleop (leader)",
  camera: "Camera",
  glove: "Data glove",
  input: "Input",
}

export function rateText(s: DeviceStream) {
  if (s.targetHz === null) return "event"
  const measured = s.measuredHz === null ? "—" : s.measuredHz.toFixed(1)
  return `${measured} / ${s.targetHz} ${s.unit}`
}

/** Warn color when the measured rate is below 98% of target, muted when not measured */
export function rateClass(s: DeviceStream) {
  if (s.targetHz === null) return "text-foreground"
  if (s.measuredHz === null) return "text-muted-foreground"
  return s.measuredHz / s.targetHz < 0.98 ? "text-warn" : "text-foreground"
}

/** Overall rig health: warn if any device is not ok, off if all are off */
export function rigHealth(devices: Device[]): Health {
  if (devices.every((d) => d.health === "off")) return "off"
  if (devices.some((d) => d.health !== "ok")) return "warn"
  return "ok"
}

/** Every device id registered in a rig (robots, input devices, cameras) */
export const rigDeviceIds = (rig: Rig) => [...rig.robots, ...rig.devices, ...rig.cameras.map((c) => c.id)]

/** Feetech STS3215 encoder span (12 bit) */
export const ENCODER_MAX = 4095

import type { Tone } from "@/components/common/status-dot"
import { listDevices } from "@/api/devices"
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

const portOf = (id: string) => listDevices().find((d) => d.id === id)?.port ?? "—"
const modelOf = (id: string) => listDevices().find((d) => d.id === id)?.name ?? id

/** Display-only serializer for the rig config file (YAML) */
export function rigToYaml(rig: Rig): string {
  const device = (id: string) => [`  - id: ${id}`, `    model: ${modelOf(id)}`, `    port: ${portOf(id)}`]
  return [
    `rig: ${rig.id}`,
    `name: ${rig.name}`,
    "robot:",
    ...rig.robots.flatMap(device),
    "device:",
    ...rig.devices.flatMap(device),
    "camera:",
    ...rig.cameras.flatMap((c) => [
      `  - id: ${c.id}`,
      `    key: ${c.key}`,
      `    port: ${portOf(c.id)}`,
      `    feature: ${c.feature}`,
      `    resolution: ${c.resolution.replace(/\D+/, "x")}`,
      `    fps: ${c.fps}`,
      `    default_on: ${c.defaultOn}`,
    ]),
    `action_space:  # ${rig.joints.length} DoF`,
    ...rig.joints.map((j) => `  - ${j}`),
    "rates:",
    `  action_hz: ${rig.targetHz.action}  # options: [${rig.actionHzOptions.join(", ")}]`,
    `  video_fps: ${rig.targetHz.video}  # options: [${rig.videoFpsOptions.join(", ")}]`,
  ].join("\n")
}

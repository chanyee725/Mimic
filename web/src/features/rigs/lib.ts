import type { Tone } from "@/components/app/status-dot"
import { DEVICES, type Device, type DeviceStream, type Health } from "@/dummy/devices"
import type { Rig } from "@/dummy/rigs"

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

/** 실측 주기가 목표의 98% 미만이면 경고 색, 미측정이면 흐리게 */
export function rateClass(s: DeviceStream) {
  if (s.targetHz === null) return "text-foreground"
  if (s.measuredHz === null) return "text-muted-foreground"
  return s.measuredHz / s.targetHz < 0.98 ? "text-warn" : "text-foreground"
}

/** Rig 전체 상태: 하나라도 경고면 warn, 모두 꺼져 있으면 off */
export function rigHealth(devices: Device[]): Health {
  if (devices.every((d) => d.health === "off")) return "off"
  if (devices.some((d) => d.health !== "ok")) return "warn"
  return "ok"
}

const portOf = (id: string) => DEVICES.find((d) => d.id === id)?.port ?? "—"
const modelOf = (id: string) => DEVICES.find((d) => d.id === id)?.name ?? id

/** Rig 설정 파일(YAML) 표시용 serializer */
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

import { DEVICES } from "@/dummy/devices"
import type { Rig } from "@/dummy/rigs"

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

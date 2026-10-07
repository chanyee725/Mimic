import type { CapturePhase } from "@/domain/capture"
import type { Device, DeviceType } from "@/domain/device"
import type { Task } from "@/domain/task"

/** Badge per phase of the station's episode state machine */
export const PHASE: Record<CapturePhase, { label: string; className: string }> = {
  idle: { label: "READY", className: "bg-muted text-muted-foreground" },
  countdown: { label: "GET READY", className: "bg-info-muted text-info" },
  recording: { label: "REC", className: "bg-bad-muted text-bad" },
  review: { label: "REVIEW", className: "bg-warn-muted text-warn" },
}

/** Device types a capture episode needs; the backend refuses to start (503) while any of them is off */
const REQUIRED: DeviceType[] = ["robot", "teleop", "camera"]

export const offlineDevices = (devices: Device[]) => devices.filter((d) => REQUIRED.includes(d.type) && d.health === "off")

/** The task has all its target episodes: Start stays off until the target is raised */
export const targetReached = (t: Task) => t.collected >= t.targetEpisodes

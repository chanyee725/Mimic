import type { Tone } from "@/components/common/status-dot"
import type { Health } from "@/domain/device"
import type { SimEnv, SimTeleopState } from "@/domain/simulation"

export const evalHref = (envId: string, modelId?: string) => `/evaluate?target=sim&env=${envId}${modelId ? `&model=${modelId}` : ""}`

export const formatKB = (kb: number) => (kb < 1024 ? `${kb.toLocaleString()} KB` : `${(kb / 1024).toFixed(1)} MB`)

/** Filter value for environments without robot tags (usable with any rig) */
export const UNTAGGED = "__untagged"

export type RobotFilter = "all" | string

export const matchesRobot = (env: SimEnv, filter: RobotFilter) =>
  filter === "all" || (filter === UNTAGGED ? env.robots.length === 0 : env.robots.includes(filter))

export const robotsLabel = (env: SimEnv) => (env.robots.length ? env.robots.join(", ") : "Any robot")

export const HEALTH_TONE: Record<Health, Tone> = { ok: "ok", warn: "warn", off: "muted" }

export const TELEOP_STATE: Record<SimTeleopState, { tone: Tone; label: string }> = {
  starting: { tone: "info", label: "Starting" },
  running: { tone: "ok", label: "Running" },
  stopped: { tone: "muted", label: "Stopped" },
}

export const formatJoint = (name: string, value: number | null) =>
  value === null ? "—" : name === "gripper" ? `${value.toFixed(1)} %` : `${value.toFixed(1)}°`

/** Keyboard jog speeds (degrees per second; Shift = slow) and how often a held key is resent */
export const JOG_DEG_S = 30
export const JOG_SLOW_DEG_S = 8
export const JOG_RESEND_MS = 150

import type { Tone } from "@/components/common/status-dot"
import type { Health } from "@/domain/device"
import type { SimEnv, SimTeleopState } from "@/domain/simulation"

/** Evaluations view with the environment (and optionally the model) preselected in the form */
export const evalHref = (envId: string, modelId?: string) => `/evaluate?target=sim&env=${envId}${modelId ? `&model=${modelId}` : ""}`

/** KB → "3 KB" / "18.0 MB" */
export const formatKB = (kb: number) => (kb < 1024 ? `${kb.toLocaleString()} KB` : `${(kb / 1024).toFixed(1)} MB`)

/** Filter value for environments without robot tags (usable with any rig) */
export const UNTAGGED = "__untagged"

/** List filter: every environment, one robot tag, or the untagged ones */
export type RobotFilter = "all" | string

export const matchesRobot = (env: SimEnv, filter: RobotFilter) =>
  filter === "all" || (filter === UNTAGGED ? env.robots.length === 0 : env.robots.includes(filter))

/** "so101_follower, koch_follower" / "Any robot" */
export const robotsLabel = (env: SimEnv) => (env.robots.length ? env.robots.join(", ") : "Any robot")

/** Device health → StatusDot tone in the teleoperation dialog */
export const HEALTH_TONE: Record<Health, Tone> = { ok: "ok", warn: "warn", off: "muted" }

/** Sim teleoperation state → StatusDot tone and label */
export const TELEOP_STATE: Record<SimTeleopState, { tone: Tone; label: string }> = {
  starting: { tone: "info", label: "Starting" },
  running: { tone: "ok", label: "Running" },
  stopped: { tone: "muted", label: "Stopped" },
}

/** Leader joint value: degrees with one decimal, the gripper in % */
export const formatJoint = (name: string, value: number | null) =>
  value === null ? "—" : name === "gripper" ? `${value.toFixed(1)} %` : `${value.toFixed(1)}°`

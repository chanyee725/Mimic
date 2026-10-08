import type { Tone } from "@/components/common/status-dot"
import type { Health } from "@/domain/device"
import type { SimAssetKind, SimEnv, SimTeleopState } from "@/domain/simulation"

export const evalHref = (envId: string, modelId?: string) => `/evaluate?target=sim&env=${envId}${modelId ? `&model=${modelId}` : ""}`

export const formatKB = (kb: number) => (kb < 1024 ? `${kb.toLocaleString()} KB` : `${(kb / 1024).toFixed(1)} MB`)

/** Filter value for environments without robot tags (usable with any rig) */
export const UNTAGGED = "__untagged"

export type RobotFilter = "all" | string

export const matchesRobot = (env: SimEnv, filter: RobotFilter) =>
  filter === "all" || (filter === UNTAGGED ? env.robots.length === 0 : env.robots.includes(filter))

export const robotsLabel = (env: SimEnv) => (env.robots.length ? env.robots.join(", ") : "Any robot")

export const HEALTH_TONE: Record<Health, Tone> = { ok: "ok", warn: "warn", off: "muted" }

/** Korean noun for an asset kind in on-screen hints */
export const KIND_NOUN: Record<SimAssetKind, string> = { robot: "로봇", tool: "도구" }

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

/** TCP jog speeds in the tool frame: translation (m/s) and, with Shift, rotation (deg/s) */
export const TCP_LIN_M_S = 0.05
export const TCP_ROT_DEG_S = 20

/** TCP jog key → twist axis (0–2 = X/Y/Z) and direction */
export const TCP_KEYS: Record<string, { axis: number; dir: number }> = {
  i: { axis: 0, dir: 1 },
  k: { axis: 0, dir: -1 },
  j: { axis: 1, dir: 1 },
  l: { axis: 1, dir: -1 },
  u: { axis: 2, dir: 1 },
  o: { axis: 2, dir: -1 },
}

export type JogMode = "tcp" | "joint"

/** The key's place on the keyboard ("i", "shift", "arrowup"), so a Korean IME (which turns I into ㅑ) still jogs */
export const physicalKey = (e: KeyboardEvent) =>
  e.code.startsWith("Key") ? e.code.slice(3).toLowerCase() : e.code.startsWith("Shift") ? "shift" : e.code.toLowerCase()

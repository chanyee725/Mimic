import type { Tone } from "@/components/common/status-dot"
import type { SimEnv, SimEnvState } from "@/domain/simulation"

export const ENV_STATE: Record<SimEnvState, { tone: Tone; label: string }> = {
  ready: { tone: "ok", label: "Ready" },
  invalid: { tone: "bad", label: "Invalid" },
}

export type EnvFilter = "all" | SimEnvState

export const ENV_FILTERS: { value: EnvFilter; label: string; fits: (e: SimEnv) => boolean }[] = [
  { value: "all", label: "All", fits: () => true },
  { value: "ready", label: "Ready", fits: (e) => e.state === "ready" },
  { value: "invalid", label: "Invalid", fits: (e) => e.state === "invalid" },
]

/** Evaluations view with the environment (and optionally the model) preselected in the form */
export const evalHref = (envId: string, modelId?: string) => `/evaluate?target=sim&env=${envId}${modelId ? `&model=${modelId}` : ""}`

/** KB → "3 KB" / "18.0 MB" */
export const formatKB = (kb: number) => (kb < 1024 ? `${kb.toLocaleString()} KB` : `${(kb / 1024).toFixed(1)} MB`)

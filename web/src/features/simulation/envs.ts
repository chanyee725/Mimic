import type { Tone } from "@/components/common/status-dot"
import { listModels } from "@/api/models"
import type { Model } from "@/domain/model"
import { envCompat, type CompatIssue, type SimEnv, type SimEnvState } from "@/domain/simulation"

import { modelSpec } from "./new-eval"

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

/** Link that opens the new evaluation form with this environment preselected */
/** Evaluations view with the environment (and optionally the model) preselected in the form */
export const evalHref = (envId: string, modelId?: string) => `/simulation?env=${envId}${modelId ? `&model=${modelId}` : ""}`

export type ModelCompat = { model: Model; issues: CompatIssue[]; usable: boolean }

/**
 * Every saved model with its compatibility for the environment.
 * Order: usable models for the environment's task, other usable ones, then blocked ones.
 */
export function modelCompat(env: SimEnv): ModelCompat[] {
  const rank = (c: ModelCompat) => (!c.usable ? 2 : c.model.taskId === env.taskId ? 0 : 1)
  return listModels()
    .map((model) => {
      const issues = envCompat(env, modelSpec(model))
      return { model, issues, usable: !issues.some((i) => i.level === "error") }
    })
    .sort((a, b) => rank(a) - rank(b))
}

/** KB → "3 KB" / "18.0 MB" */
export const formatKB = (kb: number) => (kb < 1024 ? `${kb.toLocaleString()} KB` : `${(kb / 1024).toFixed(1)} MB`)

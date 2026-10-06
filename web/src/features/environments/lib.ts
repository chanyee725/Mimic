import type { Rig } from "@/domain/rig"
import type { SimEnv } from "@/domain/simulation"

/** Evaluations view with the environment (and optionally the model) preselected in the form */
export const evalHref = (envId: string, modelId?: string) => `/evaluate?target=sim&env=${envId}${modelId ? `&model=${modelId}` : ""}`

/** KB → "3 KB" / "18.0 MB" */
export const formatKB = (kb: number) => (kb < 1024 ? `${kb.toLocaleString()} KB` : `${(kb / 1024).toFixed(1)} MB`)

/** Filter value for environments at the top level (usable with any rig) */
export const ANY_RIG = "__any"

/** Rig name for a rig folder; "Any rig" for the top level */
export const rigLabel = (rigId: string | null, rigs: Rig[]) => (rigId ? (rigs.find((r) => r.id === rigId)?.name ?? rigId) : "Any rig")

/** List filter: every environment, one rig folder, or the top level */
export type RigFilter = "all" | string

export const rigOf = (env: SimEnv) => env.rigId ?? ANY_RIG

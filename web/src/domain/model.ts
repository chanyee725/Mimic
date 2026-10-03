// Saved model entities — wire shapes of docs/api/models.md

/** One Evaluate session on the real robot */
export type ModelEval = { at: string; trials: number; success: number; instruction: string }

export type Model = {
  id: string
  name: string
  taskId: string
  dataset: string
  jobId: string
  step: number
  /** Smoothed train loss when saved */
  loss: number
  sizeMB: number
  /** ISO timestamp */
  savedAt: string
  /** Folder on this station */
  localPath?: string | null
  /** HF Hub repository (private) */
  hubRepo?: string | null
  evals: ModelEval[]
}

/** A file inside a saved lerobot checkpoint folder */
export type ModelFile = { path: string; sizeMB: number }

export type ModelLocation = "local" | "hub"

/** Success rate (0–1) over all saved evaluations, undefined if none */
export function successRate(m: Model) {
  const trials = m.evals.reduce((a, e) => a + e.trials, 0)
  return trials ? m.evals.reduce((a, e) => a + e.success, 0) / trials : undefined
}

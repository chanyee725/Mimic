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
  savedAt: string
  /** Folder on this station */
  localPath?: string
  /** HF Hub repository (private) */
  hubRepo?: string
  evals: ModelEval[]
}

/** Success rate (0–1) over all saved evaluations, undefined if none */
export function successRate(m: Model) {
  const trials = m.evals.reduce((a, e) => a + e.trials, 0)
  return trials ? m.evals.reduce((a, e) => a + e.success, 0) / trials : undefined
}

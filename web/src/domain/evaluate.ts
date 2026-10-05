// Real-robot evaluation runs — wire shapes of docs/api/models.md

/** loading: policy onto the GPU, robot connected · running: the policy drives the arm · judging: holds its pose */
export type EvalRunState = "loading" | "running" | "judging" | "done"

export type EvalVerdict = "success" | "fail"

export type EvalRun = {
  id: string
  modelId: string
  instruction: string
  /** Optional time limit (s); null runs until Stop (the server still ends it after 10 min) */
  limitS?: number | null
  /** Speed limit, % of the servos' top speed; null: the policy's actions are sent as they are */
  speedPct?: number | null
  /** Record the run as an episode */
  record: boolean
  state: EvalRunState
  /** ISO timestamp */
  startedAt: string
  elapsedS: number
  /** Set once judged; discarded runs stay without a result */
  result?: EvalVerdict | null
  /** Why the run ended early (camera lost, policy or robot error); such a run is not counted */
  error?: string | null
}

/** Body of POST /evaluate/runs */
export type EvalRunCreate = { modelId: string; instruction: string; limitS?: number; speedPct?: number | null; record?: boolean }

/** Verdict sent to POST /evaluate/runs/{id}/result */
export type EvalJudgement = EvalVerdict | "discard"

/** A run that is still on the robot or waiting for a verdict */
export const isEvalActive = (r: EvalRun) => r.state !== "done"

/** Judged trials only (done with a success / fail verdict) */
export const judgedRuns = (runs: EvalRun[]) => runs.filter((r) => r.state === "done" && !!r.result)

import { judgedRuns, type EvalRun, type EvalVerdict } from "@/domain/evaluate"

/** One run: idle -> loading the policy -> policy running -> human judges the result */
export type RunPhase = "idle" | "loading" | "running" | "judging"

export type Trial = { n: number; instruction: string; seconds: number; result: EvalVerdict }

/** Judged runs of this session as numbered trials, oldest first */
export function trialsOf(runs: EvalRun[]): Trial[] {
  return judgedRuns(runs)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((r, i) => ({ n: i + 1, instruction: r.instruction, seconds: r.elapsedS, result: r.result! }))
}

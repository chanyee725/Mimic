import { getRig } from "@/api/rigs"
import { listSimEnvs, listSimJobs } from "@/api/simulation"
import { getTask } from "@/api/tasks"
import { listJobs } from "@/api/training"
import type { Model } from "@/domain/model"
import { envCompat, type CompatIssue, type ModelSpec, type Randomization, type SimEnv } from "@/domain/simulation"

/** Defaults for the new evaluation form */
export const NEW_EVAL_DEFAULTS: { episodes: number; seedStart: number; maxSeconds: number; randomization: Randomization } = {
  episodes: 50,
  seedStart: 1000,
  maxSeconds: 40,
  randomization: "low",
}

/** Cameras and action size a saved model expects, from the task and rig it was trained on */
export function modelSpec(model: Model): ModelSpec {
  const task = getTask(model.taskId)
  const rig = getRig(task?.rigId ?? "")
  return { cameras: task?.cameras ?? [], actionDim: rig.joints.length }
}

export type EnvOption = { env: SimEnv; issues: CompatIssue[]; usable: boolean }

/**
 * Every registered environment with its compatibility for the model. Order: usable environments
 * for the model's task, other usable ones, then the ones the model can't be loaded into.
 */
export function envOptions(model?: Model): EnvOption[] {
  const spec = model ? modelSpec(model) : undefined
  const rank = (o: EnvOption) => (!o.usable ? 2 : o.env.taskId === model?.taskId ? 0 : 1)
  return listSimEnvs()
    .map((env) => {
      const issues = spec ? envCompat(env, spec) : []
      return { env, issues, usable: !issues.some((i) => i.level === "error") }
    })
    .sort((a, b) => rank(a) - rank(b))
}

/** Id of the job holding the local GPU right now (a running sim job or a local training job), if any */
export function simGpuHolder(): string | undefined {
  const sim = listSimJobs().find((j) => j.status === "running")
  if (sim) return sim.id
  return listJobs().find((j) => j.compute === "local" && j.status === "running")?.id
}

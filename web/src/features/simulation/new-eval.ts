import type { Model } from "@/domain/model"
import type { Rig } from "@/domain/rig"
import { envCompat, type CompatIssue, type ModelSpec, type Randomization, type SimEnv } from "@/domain/simulation"
import type { Task } from "@/domain/task"

/** Defaults for the new evaluation form (same as the backend's POST /sim/jobs defaults) */
export const NEW_EVAL_DEFAULTS: { episodes: number; seedStart: number; maxSeconds: number; randomization: Randomization } = {
  episodes: 50,
  seedStart: 1000,
  maxSeconds: 40,
  randomization: "low",
}

/** Cameras and action size a saved model expects, from the task and rig it was trained on */
export function modelSpec(model: Model, tasks: Task[], rigs: Rig[]): ModelSpec {
  const task = tasks.find((t) => t.id === model.taskId)
  const rig = rigs.find((r) => r.id === task?.rigId)
  return { cameras: task?.cameras ?? [], actionDim: rig?.joints.length ?? 0 }
}

export type EnvOption = { env: SimEnv; issues: CompatIssue[]; usable: boolean }

/**
 * Every registered environment with its compatibility for the model. Order: usable environments
 * for the model's task, other usable ones, then the ones the model can't be loaded into.
 */
export function envOptions(envs: SimEnv[], model?: Model, spec?: ModelSpec): EnvOption[] {
  const rank = (o: EnvOption) => (!o.usable ? 2 : o.env.taskId === model?.taskId ? 0 : 1)
  return envs
    .map((env) => {
      const issues = spec ? envCompat(env, spec) : []
      return { env, issues, usable: !issues.some((i) => i.level === "error") }
    })
    .sort((a, b) => rank(a) - rank(b))
}

/** The preferred environment if the model can be loaded into it, else the first usable one */
export function usableEnvId(options: EnvOption[], preferredId?: string): string | undefined {
  const preferred = options.find((o) => o.env.id === preferredId)
  if (preferred?.usable) return preferred.env.id
  return options.find((o) => o.usable)?.env.id
}

/**
 * Initial model and environment for the form. A model from ?model= wins; otherwise, when the default
 * model can't be loaded into the ?env= environment, the first model (list order) that can is chosen.
 */
export function initialSelection(
  models: Model[],
  optionsFor: (m?: Model) => EnvOption[],
  envId?: string,
  modelId?: string,
): { modelId: string; envId?: string } {
  const fits = (m: Model) => optionsFor(m).some((o) => o.env.id === envId && o.usable)
  const requested = models.find((m) => m.id === modelId)
  const model = requested ?? (envId && models[0] && !fits(models[0]) ? (models.find(fits) ?? models[0]) : models[0])
  return { modelId: model?.id ?? "", envId: usableEnvId(optionsFor(model), envId) }
}

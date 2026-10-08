import type { Model } from "@/domain/model"
import { envFitsRig, type Randomization, type SimEnv } from "@/domain/simulation"
import type { Task } from "@/domain/task"

/** Defaults for the new evaluation form (same as the backend's POST /sim/jobs defaults) */
export const NEW_EVAL_DEFAULTS: { episodes: number; seedStart: number; maxSeconds: number; randomization: Randomization } = {
  episodes: 50,
  seedStart: 1000,
  maxSeconds: 40,
  randomization: "low",
}

/** The Isaac Sim environment the model's task was recorded in, if any */
export const taskEnvId = (model: Model | undefined, tasks: Task[]) => tasks.find((t) => t.id === model?.taskId)?.envId ?? undefined

/** Environments usable by the rig of the model's task (its robot tags fit the rig, or untagged) */
export const usableEnvs = (envs: SimEnv[], model: Model | undefined, tasks: Task[]) =>
  envs.filter((e) => envFitsRig(e, tasks.find((t) => t.id === model?.taskId)?.rigId))

/** Environments with the model's task environment first */
export const orderEnvs = (envs: SimEnv[], taskEnv?: string) => [...envs].sort((a, b) => Number(b.id === taskEnv) - Number(a.id === taskEnv))

/** The preferred environment when it exists, else the model's task environment, else the first one */
export function pickEnvId(envs: SimEnv[], taskEnv?: string, preferred?: string): string | undefined {
  const has = (id?: string) => !!id && envs.some((e) => e.id === id)
  if (has(preferred)) return preferred
  if (has(taskEnv)) return taskEnv
  return envs[0]?.id
}

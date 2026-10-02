import { listSimJobs, listSimScenes } from "@/api/simulation"
import { listJobs } from "@/api/training"
import type { Randomization, SimScene } from "@/domain/simulation"

/** Defaults for the new evaluation form */
export const NEW_EVAL_DEFAULTS: { episodes: number; seedStart: number; maxSeconds: number; randomization: Randomization } = {
  episodes: 50,
  seedStart: 1000,
  maxSeconds: 40,
  randomization: "low",
}

/** All scenes, the ones for the given task first */
export function scenesForTask(taskId?: string): SimScene[] {
  const scenes = listSimScenes()
  return [...scenes.filter((s) => s.taskId === taskId), ...scenes.filter((s) => s.taskId !== taskId)]
}

/** Id of the job holding the local GPU right now (a running sim job or a local training job), if any */
export function simGpuHolder(): string | undefined {
  const sim = listSimJobs().find((j) => j.status === "running")
  if (sim) return sim.id
  return listJobs().find((j) => j.compute === "local" && j.status === "running")?.id
}

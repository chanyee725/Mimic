import type { SimEnv, SimEpisode, SimEpisodeResult, SimJob } from "@/domain/simulation"
import { plural } from "@/lib/format"

import { RANDOMIZATION } from "./sim"

export type ResultFilter = "all" | SimEpisodeResult

/** Episode filters with their counts from the job's totals */
export const RESULT_FILTERS: { value: ResultFilter; label: string; count: (job: SimJob) => number }[] = [
  { value: "all", label: "All", count: (j) => j.done },
  { value: "success", label: "Success", count: (j) => j.succeeded },
  { value: "fail", label: "Fail", count: (j) => j.done - j.succeeded },
]

export const EPISODES_PER_PAGE = 20

export const randomizationLabel = (job: SimJob) => RANDOMIZATION.find((r) => r.value === job.randomization)?.label ?? job.randomization

/** "1000–1099" */
export const seedRange = (job: SimJob) => `${job.seedStart}–${job.seedStart + job.episodes - 1}`

/** Page description: "sim_012, Tabletop, two blocks, 100 episodes, randomization Low, seeds 1000–1099" */
export function jobDescription(job: SimJob, env?: SimEnv) {
  return [
    job.id,
    env?.name ?? job.envId,
    plural(job.episodes, "episode"),
    `randomization ${randomizationLabel(job)}`,
    `seeds ${seedRange(job)}`,
  ].join(", ")
}

/** Mean episode length (s) over the given episodes, undefined when there are none */
export const avgSeconds = (episodes: SimEpisode[]) =>
  episodes.length ? episodes.reduce((a, e) => a + e.seconds, 0) / episodes.length : undefined

/** "Episode #12, seed 1012, Fail — Grasp slipped" */
export const episodeText = (e: SimEpisode) =>
  `Episode #${e.index}, seed ${e.seed}, ${e.success ? "Success" : `Fail${e.reason ? ` — ${e.reason}` : ""}`}`

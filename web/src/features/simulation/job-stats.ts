import type { SimEpisode, SimJob, SimScene } from "@/domain/simulation"
import { plural } from "@/lib/format"

import { RANDOMIZATION } from "./lib"

export type ResultFilter = "all" | "success" | "fail"

export const RESULT_FILTERS: { value: ResultFilter; label: string; match: (e: SimEpisode) => boolean }[] = [
  { value: "all", label: "All", match: () => true },
  { value: "success", label: "Success", match: (e) => e.success },
  { value: "fail", label: "Fail", match: (e) => !e.success },
]

export const EPISODES_PER_PAGE = 20

export const randomizationLabel = (job: SimJob) => RANDOMIZATION.find((r) => r.value === job.randomization)?.label ?? job.randomization

/** "1000–1099" */
export const seedRange = (job: SimJob) => `${job.seedStart}–${job.seedStart + job.episodes - 1}`

/** Page description: "sim_012, Tabletop, two blocks, 100 episodes, randomization Low, seeds 1000–1099" */
export function jobDescription(job: SimJob, scene?: SimScene) {
  return [
    job.id,
    scene?.name ?? job.sceneId,
    plural(job.episodes, "episode"),
    `randomization ${randomizationLabel(job)}`,
    `seeds ${seedRange(job)}`,
  ].join(", ")
}

export const successCount = (results: SimEpisode[]) => results.filter((e) => e.success).length

/** Mean episode length (s), undefined before the first episode */
export const avgSeconds = (results: SimEpisode[]) =>
  results.length ? results.reduce((a, e) => a + e.seconds, 0) / results.length : undefined

/** Failure reasons with counts, most frequent first */
export function failureReasons(results: SimEpisode[]) {
  const counts = new Map<string, number>()
  for (const e of results) {
    if (e.success) continue
    const reason = e.reason ?? "Unknown"
    counts.set(reason, (counts.get(reason) ?? 0) + 1)
  }
  return [...counts].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count)
}

/** "Episode #12, seed 1012, Fail — Grasp slipped" */
export const episodeText = (e: SimEpisode) =>
  `Episode #${e.index}, seed ${e.seed}, ${e.success ? "Success" : `Fail${e.reason ? ` — ${e.reason}` : ""}`}`

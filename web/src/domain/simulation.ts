/** Isaac Sim scene that mirrors a real task setup on the SO-101 rig */
export type SimScene = {
  id: string
  name: string
  taskId: string
  /** USD stage path on the station */
  usd: string
  cameras: string[]
  /** Camera poses, FOV and joint limits were matched to the real rig */
  calibrated: boolean
  note?: string
}

/** How strongly lighting, object poses / colours and camera pose are randomized per episode */
export type Randomization = "none" | "low" | "high"

export type SimEpisode = {
  index: number
  seed: number
  success: boolean
  seconds: number
  /** Why a failed episode failed (from the scene's success checker) */
  reason?: string
}

export type SimJobStatus = "running" | "queued" | "done" | "failed" | "stopped"

/** One batch evaluation of a model in a scene */
export type SimJob = {
  id: string
  modelId: string
  sceneId: string
  status: SimJobStatus
  episodes: number
  randomization: Randomization
  seedStart: number
  /** Time limit per episode (s) */
  maxSeconds: number
  startedAt?: string
  elapsed?: string
  eta?: string
  /** Finished episodes so far */
  results: SimEpisode[]
  error?: string
}

/** Success rate (0–1) over finished episodes, undefined before the first one */
export function simSuccessRate(job: SimJob) {
  return job.results.length ? job.results.filter((e) => e.success).length / job.results.length : undefined
}

export const isSimActive = (job: SimJob) => job.status === "running" || job.status === "queued"

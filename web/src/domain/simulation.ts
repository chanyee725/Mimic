/**
 * An Isaac Sim environment the user built and registered by dropping a folder into the
 * environments directory (`VLA_SIM_ENVS_DIR` in the repo-root .env, default sim/envs). The station scans that folder;
 * each sub-folder with an env.yaml becomes one environment a saved model can be loaded into.
 */
export type SimEnvState = "ready" | "invalid"

export type SimEnvFile = { path: string; sizeKB: number }

export type SimEnv = {
  /** Folder name, used as the id */
  id: string
  name: string
  /** Absolute folder on the station */
  path: string
  description?: string
  /** Task this environment reproduces, if it maps to one */
  taskId?: string
  /** Camera keys the environment renders (must cover the model's cameras) */
  cameras: string[]
  /** Size of the action / joint state vectors the environment accepts */
  actionDim: number
  /** Default time limit per episode (s) */
  maxSeconds: number
  /** Camera poses, FOV and joint limits were matched to the real rig */
  calibrated: boolean
  state: SimEnvState
  /** Why the folder could not be loaded (state "invalid") */
  error?: string
  /** env.yaml as found on disk */
  manifest: string
  files: SimEnvFile[]
  registeredAt: string
  updatedAt: string
}

/** What a model needs from an environment */
export type ModelSpec = { cameras: string[]; actionDim: number }

export type CompatIssue = { level: "error" | "warn"; text: string }

/** One saved model checked against an environment (GET /sim/envs/{id}/compat) */
export type ModelCompat = { modelId: string; usable: boolean; issues: CompatIssue[] }

/** GPU Isaac Sim runs on; busyBy is the sim job holding it */
export type SimGpu = { id: string; name: string; vram: string; busyBy?: string }

/** GET /sim/config */
export type SimConfig = { envsDir: string; gpu: SimGpu }

/** POST /sim/envs/rescan */
export type RescanResult = { dir: string; scannedAt: string; envs: SimEnv[] }

/** Can this model be loaded into this environment? Errors block an evaluation, warnings don't */
export function envCompat(env: SimEnv, spec: ModelSpec): CompatIssue[] {
  const issues: CompatIssue[] = []
  if (env.state !== "ready") issues.push({ level: "error", text: env.error ?? "Environment failed to load" })
  const missing = spec.cameras.filter((c) => !env.cameras.includes(c))
  if (missing.length) issues.push({ level: "error", text: `Missing camera ${missing.join(", ")}` })
  if (env.actionDim !== spec.actionDim)
    issues.push({ level: "error", text: `Action size ${env.actionDim}, model expects ${spec.actionDim}` })
  if (!env.calibrated) issues.push({ level: "warn", text: "Not matched to the real rig" })
  return issues
}

/** How strongly lighting, object poses / colours and camera pose are randomized per episode */
export type Randomization = "none" | "low" | "high"

export type SimEpisode = {
  index: number
  seed: number
  success: boolean
  seconds: number
  /** Why a failed episode failed (from the environment's success check) */
  reason?: string
}

export type SimJobStatus = "running" | "queued" | "done" | "failed" | "stopped"

/** One batch evaluation of a model loaded into an environment */
export type SimJob = {
  id: string
  modelId: string
  envId: string
  status: SimJobStatus
  episodes: number
  randomization: Randomization
  seedStart: number
  /** Time limit per episode (s) */
  maxSeconds: number
  startedAt?: string
  /** Seconds since start */
  elapsedS?: number
  /** Estimated seconds left */
  etaS?: number
  /** Finished episodes so far (the episodes themselves are paged via /episodes) */
  done: number
  /** Successful episodes among `done` */
  succeeded: number
  /** Failure reason → count over finished episodes */
  failureReasons: Record<string, number>
  error?: string
}

/** POST /sim/jobs body (backend defaults: 50 episodes, seed 1000, 40 s, "low") */
export type SimJobCreate = {
  modelId: string
  envId: string
  episodes?: number
  seedStart?: number
  maxSeconds?: number
  randomization?: Randomization
}

/** Episode filter for the paged episodes list */
export type SimEpisodeResult = "success" | "fail"

/** Success rate (0–1) over finished episodes, undefined before the first one */
export function simSuccessRate(job: SimJob) {
  return job.done ? job.succeeded / job.done : undefined
}

/** Progress (0–1) through the planned episodes */
export const simJobPct = (job: SimJob) => (job.episodes ? job.done / job.episodes : 0)

/** Failure reasons, most frequent first */
export const simFailureReasons = (job: SimJob) =>
  Object.entries(job.failureReasons)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)

export const isSimActive = (job: SimJob) => job.status === "running" || job.status === "queued"

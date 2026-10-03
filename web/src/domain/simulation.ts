/**
 * An Isaac Sim environment the user built and registered by dropping a folder into the
 * environments directory (Settings → Training → Simulation). The station scans that folder;
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

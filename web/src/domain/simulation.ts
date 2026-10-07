import type { IsaacDevice, IsaacDisplay, IsaacMode } from "./settings"

/**
 * An Isaac Sim environment: a Python script whose build(scene) lays out the stage, dropped into the environments
 * directory (envs/ under `VLA_SIM_DIR`, default data/sims/envs). A folder with env.py and its own files also counts.
 */
export type SimEnvFile = { path: string; sizeKB: number }

export type SimEnv = {
  /** File stem or folder name */
  id: string
  name: string
  /** Absolute file or folder on the station */
  path: string
  /** env.py for a folder, the file name for a single script */
  script: string
  sizeKB: number
  files: SimEnvFile[]
  /** Robot tags (robot USDs under data/sims/robot/, kept in data/sims/envs.yaml); [] = untagged, fits any rig */
  robots: string[]
  /** Configured rigs whose followers are all tagged robots (every rig when untagged) */
  rigIds: string[]
  /** A same-name image is served at /sim/envs/{id}/thumbnail */
  thumbnail: boolean
  registeredAt: string
  updatedAt: string
}

/** A robot USD under data/sims/robot/, named after the LeRobot type it simulates (e.g. so101_follower) */
export type SimRobot = { id: string; path: string }

/** An environment is usable by a rig when the backend lists the rig as fitting its robot tags */
export const envFitsRig = (env: Pick<SimEnv, "rigIds">, rigId: string | undefined) => !rigId || env.rigIds.includes(rigId)

/** GPU Isaac Sim runs on; busyBy is the sim job holding it */
export type SimGpu = { id: string; name: string; vram: string; busyBy?: string }

/** GET /sim/config */
export type SimConfig = { envsDir: string; gpu: SimGpu }

/** POST /sim/envs/rescan */
export type SimAppState = "stopped" | "starting" | "running" | "exited"

/** Isaac Sim app process behind the server; scene is the open environment's id */
export type SimRunnerApp = {
  state: SimAppState
  display: IsaacDisplay | null
  device: IsaacDevice | null
  pid: number | null
  scene: string | null
  error: string | null
}

/** Isaac Sim server; app is null when the server is not reachable */
export type SimRunner = {
  mode: IsaacMode
  display: IsaacDisplay
  device: IsaacDevice
  url: string
  reachable: boolean
  app: SimRunnerApp | null
}

export type RescanResult = { dir: string; scannedAt: string; envs: SimEnv[] }

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

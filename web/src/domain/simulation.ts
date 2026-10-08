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
  /** Robot tags (robot USDs under data/sims/robots/, kept in data/sims/envs.yaml); [] = untagged, fits any rig */
  robots: string[]
  /** Configured rigs whose followers are all tagged robots (every rig when untagged) */
  rigIds: string[]
  /** A same-name image is served at /sim/envs/{id}/thumbnail */
  thumbnail: boolean
  registeredAt: string
  updatedAt: string
}

/**
 * A robot USD under data/sims/robots/ (named after the LeRobot type it simulates, e.g. so101_follower) or an end
 * effector under data/sims/tools/ (robot hand, gripper): <id>.usd or <id>/<id>.usd with its sub-files
 */
export type SimAsset = {
  id: string
  /** Absolute path of the root USD */
  path: string
  sizeKB: number
  /** Relative to its folder; the file name for a single file */
  files: SimEnvFile[]
  updatedAt: string
  /** Leader device types (LeRobot, e.g. so101_leader) that can drive it; [] = none, always [] for tools */
  teleop: string[]
  /** Robots: start pose from <id>/robot.yaml (joint → degrees; gripper 0–100); null when unset */
  initialPose: Record<string, number> | null
  /** Robots: what a leader reads in initialPose (robot.yaml leader.rest); teleoperation sends initialPose + (reading − rest) */
  leaderRest: Record<string, number> | null
}

export type SimAssetKind = "robot" | "tool"

/** App scene name while a robot or tool is open alone (POST /sim/robots/{id}/open) */
export const simAssetScene = (kind: SimAssetKind, id: string) => `${kind}-${id}`

export type SimTeleopState = "starting" | "running" | "stopped"

/** Leader joint value: degrees, gripper 0–100 */
export type SimTeleopJoint = { name: string; value: number | null }

/**
 * Teleoperation of a robot opened alone in Isaac Sim by a real leader arm (GET / POST / DELETE /sim/teleop).
 * starting: waiting for Isaac Sim to open the robot (the first launch can take minutes); stopped: ended, see error
 */
export type SimTeleop = {
  robotId: string
  deviceId: string
  state: SimTeleopState
  hz: number | null
  targetHz: number
  error: string | null
  startedAt: string
  joints: SimTeleopJoint[]
}

/** POST /sim/teleop body; display defaults to the Connection setting */
export type SimTeleopCreate = { robotId: string; deviceId: string; display?: IsaacDisplay }

/** Device id of keyboard teleoperation: jog any robot's joints from the page (no leader arm) */
export const SIM_KEYBOARD = "keyboard"

export const isSimTeleopActive = (t: SimTeleop | null | undefined) => t?.state === "starting" || t?.state === "running"

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
  /** Drive target per joint of the open robot (degrees) */
  joints: Record<string, number> | null
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

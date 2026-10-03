// Mock Isaac Sim environments (registered folders) and evaluation jobs. Simulation runs only on the station's local RTX 4090.

import type { Randomization, SimEnv, SimEnvFile, SimEpisode, SimJob } from "@/domain/simulation"

export const SIM_GPU = { id: "cuda:0", name: "RTX 4090", vram: "24 GB" }

/** Folder the station scans for environments (one sub-folder per environment) */
export const SIM_ENVS_DIR = "sim/envs"

const files = (extra: SimEnvFile[] = []): SimEnvFile[] => [
  { path: "env.yaml", sizeKB: 1 },
  { path: "scene.usd", sizeKB: 18_400 },
  { path: "success.py", sizeKB: 3 },
  ...extra,
]

export const SIM_ENVS: SimEnv[] = [
  {
    id: "stack-two-blocks",
    name: "Tabletop, two blocks",
    path: `${SIM_ENVS_DIR}/stack-two-blocks`,
    description: "Two 4 cm blocks on a 60×40 cm table, same layout as the real workbench.",
    taskId: "stack-two-blocks",
    cameras: ["top", "wrist"],
    actionDim: 6,
    maxSeconds: 40,
    calibrated: true,
    state: "ready",
    manifest: `name: Tabletop, two blocks
task: stack-two-blocks
robot: so101
scene: scene.usd
cameras:
  top: { resolution: [640, 480], fps: 30 }
  wrist: { resolution: [640, 480], fps: 30 }
action_dim: 6
episode:
  max_seconds: 40
  success: success.py:check
`,
    files: files([{ path: "assets/blocks.usd", sizeKB: 640 }]),
    registeredAt: "2026-09-20 10:12",
    updatedAt: "2026-10-01 17:40",
  },
  {
    id: "pick-red-cube",
    name: "Tabletop, red cube and bowl",
    path: `${SIM_ENVS_DIR}/pick-red-cube`,
    taskId: "pick-red-cube",
    cameras: ["top", "wrist"],
    actionDim: 6,
    maxSeconds: 40,
    calibrated: true,
    state: "ready",
    manifest: `name: Tabletop, red cube and bowl
task: pick-red-cube
robot: so101
scene: scene.usd
cameras:
  top: { resolution: [640, 480], fps: 30 }
  wrist: { resolution: [640, 480], fps: 30 }
action_dim: 6
episode:
  max_seconds: 40
  success: success.py:check
`,
    files: files(),
    registeredAt: "2026-09-22 14:30",
    updatedAt: "2026-09-28 09:05",
  },
  {
    id: "open-drawer",
    name: "Cabinet with top drawer",
    path: `${SIM_ENVS_DIR}/open-drawer`,
    taskId: "open-drawer",
    cameras: ["top", "wrist"],
    actionDim: 6,
    maxSeconds: 40,
    calibrated: true,
    state: "ready",
    manifest: `name: Cabinet with top drawer
task: open-drawer
robot: so101
scene: scene.usd
cameras:
  top: { resolution: [640, 480], fps: 30 }
  wrist: { resolution: [640, 480], fps: 30 }
action_dim: 6
episode:
  max_seconds: 40
  success: success.py:check
`,
    files: files(),
    registeredAt: "2026-09-25 11:00",
    updatedAt: "2026-09-30 16:22",
  },
  {
    id: "sort-by-color",
    name: "Colour trays",
    path: `${SIM_ENVS_DIR}/sort-by-color`,
    description: "Top camera pose not matched to the rig yet",
    taskId: "sort-by-color",
    cameras: ["top", "wrist"],
    actionDim: 6,
    maxSeconds: 40,
    calibrated: false,
    state: "ready",
    manifest: `name: Colour trays
task: sort-by-color
robot: so101
scene: scene.usd
cameras:
  top: { resolution: [640, 480], fps: 30 }
  wrist: { resolution: [640, 480], fps: 30 }
action_dim: 6
episode:
  max_seconds: 40
  success: success.py:check
`,
    files: files(),
    registeredAt: "2026-09-29 13:45",
    updatedAt: "2026-10-01 18:01",
  },
  {
    id: "clutter-stress",
    name: "Cluttered table (stress test)",
    path: `${SIM_ENVS_DIR}/clutter-stress`,
    description: "Ten random distractor objects around the target. Not tied to a task; use it to check robustness.",
    cameras: ["top", "wrist"],
    actionDim: 6,
    maxSeconds: 40,
    calibrated: true,
    state: "ready",
    manifest: `name: Cluttered table (stress test)
robot: so101
scene: scene.usd
cameras:
  top: { resolution: [640, 480], fps: 30 }
  wrist: { resolution: [640, 480], fps: 30 }
action_dim: 6
episode:
  max_seconds: 40
  success: success.py:check
`,
    files: files(),
    registeredAt: "2026-10-01 20:10",
    updatedAt: "2026-10-01 20:10",
  },
  {
    id: "top-only-demo",
    name: "Top camera only",
    path: `${SIM_ENVS_DIR}/top-only-demo`,
    description: "Older demo scene with only the top camera.",
    cameras: ["top"],
    actionDim: 6,
    maxSeconds: 40,
    calibrated: true,
    state: "ready",
    manifest: `name: Top camera only
robot: so101
scene: scene.usd
cameras:
  top: { resolution: [640, 480], fps: 30 }
action_dim: 6
episode:
  max_seconds: 40
  success: success.py:check
`,
    files: files(),
    registeredAt: "2026-09-18 09:30",
    updatedAt: "2026-09-18 09:30",
  },
  {
    id: "pour-into-cup",
    name: "Two cups",
    path: `${SIM_ENVS_DIR}/pour-into-cup`,
    cameras: ["top", "wrist"],
    actionDim: 6,
    maxSeconds: 40,
    calibrated: true,
    state: "invalid",
    error: "env.yaml: success.py not found (expected success.py:check)",
    manifest: `name: Two cups
robot: so101
scene: scene.usd
cameras:
  top: { resolution: [640, 480], fps: 30 }
  wrist: { resolution: [640, 480], fps: 30 }
action_dim: 6
episode:
  max_seconds: 40
  success: success.py:check
`,
    files: [
      { path: "env.yaml", sizeKB: 1 },
      { path: "scene.usd", sizeKB: 12_100 },
    ],
    registeredAt: "2026-10-02 08:50",
    updatedAt: "2026-10-02 08:50",
  },
]

const REASONS = ["Grasp slipped", "Timed out", "Dropped object", "Wrong placement", "Collision with table"]

/** Deterministic episode results so the mock looks the same on every load */
function results(count: number, successRatio: number, seedStart: number, avg: number): SimEpisode[] {
  return Array.from({ length: count }, (_, i) => {
    const h = Math.sin((seedStart + i) * 12.9898) * 43758.5453
    const r = h - Math.floor(h)
    const success = r < successRatio
    return {
      index: i,
      seed: seedStart + i,
      success,
      seconds: +(avg * (0.75 + ((r * 7) % 1) * 0.5) * (success ? 1 : 1.3)).toFixed(1),
      reason: success ? undefined : REASONS[Math.floor(r * 97) % REASONS.length],
    }
  })
}

const job = (j: Omit<SimJob, "randomization" | "maxSeconds"> & Partial<Pick<SimJob, "randomization" | "maxSeconds">>): SimJob => ({
  randomization: "low" as Randomization,
  maxSeconds: 40,
  ...j,
})

export const SIM_JOBS: SimJob[] = [
  job({
    id: "sim_012",
    modelId: "m-stack-20k",
    envId: "stack-two-blocks",
    status: "running",
    episodes: 100,
    seedStart: 1000,
    startedAt: "2026-10-02 14:05",
    elapsed: "21m",
    eta: "36m",
    results: results(37, 0.62, 1000, 24),
  }),
  job({
    id: "sim_013",
    modelId: "m-stack-10k",
    envId: "stack-two-blocks",
    status: "queued",
    episodes: 100,
    seedStart: 1000,
    results: [],
  }),
  job({
    id: "sim_011",
    modelId: "m-open-drawer-20k",
    envId: "open-drawer",
    status: "done",
    episodes: 50,
    seedStart: 2000,
    randomization: "high",
    startedAt: "2026-10-02 09:10",
    elapsed: "31m",
    results: results(50, 0.82, 2000, 19),
  }),
  job({
    id: "sim_010",
    modelId: "m-open-drawer-15k",
    envId: "open-drawer",
    status: "done",
    episodes: 50,
    seedStart: 2000,
    randomization: "high",
    startedAt: "2026-10-01 20:40",
    elapsed: "33m",
    results: results(50, 0.7, 2000, 20),
  }),
  job({
    id: "sim_009",
    modelId: "m-stack-20k",
    envId: "sort-by-color",
    status: "failed",
    episodes: 50,
    seedStart: 3000,
    startedAt: "2026-10-01 18:02",
    elapsed: "1m",
    results: [],
    error:
      "Isaac Sim could not load sort-by-color/scene.usd: missing asset trays/blue_tray.usd. Re-export the scene into the environment folder and rescan.",
  }),
]

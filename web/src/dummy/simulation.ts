// Mock Isaac Sim scenes and evaluation jobs. Simulation runs only on the station's local RTX 4090.

import type { Randomization, SimEpisode, SimJob, SimScene } from "@/domain/simulation"

export const SIM_GPU = { id: "cuda:0", name: "RTX 4090", vram: "24 GB" }

export const SIM_SCENES: SimScene[] = [
  {
    id: "scn-stack",
    name: "Tabletop, two blocks",
    taskId: "stack-two-blocks",
    usd: "~/vla/sim/scenes/stack_two_blocks.usd",
    cameras: ["top", "wrist"],
    calibrated: true,
  },
  {
    id: "scn-pick",
    name: "Tabletop, red cube and bowl",
    taskId: "pick-red-cube",
    usd: "~/vla/sim/scenes/pick_red_cube.usd",
    cameras: ["top", "wrist"],
    calibrated: true,
  },
  {
    id: "scn-drawer",
    name: "Cabinet with top drawer",
    taskId: "open-drawer",
    usd: "~/vla/sim/scenes/open_drawer.usd",
    cameras: ["top", "wrist"],
    calibrated: true,
  },
  {
    id: "scn-sort",
    name: "Colour trays",
    taskId: "sort-by-color",
    usd: "~/vla/sim/scenes/sort_by_color.usd",
    cameras: ["top", "wrist"],
    calibrated: false,
    note: "Top camera pose not matched to the rig yet",
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
    sceneId: "scn-stack",
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
    sceneId: "scn-stack",
    status: "queued",
    episodes: 100,
    seedStart: 1000,
    results: [],
  }),
  job({
    id: "sim_011",
    modelId: "m-open-drawer-20k",
    sceneId: "scn-drawer",
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
    sceneId: "scn-drawer",
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
    sceneId: "scn-sort",
    status: "failed",
    episodes: 50,
    seedStart: 3000,
    startedAt: "2026-10-01 18:02",
    elapsed: "1m",
    results: [],
    error: "Isaac Sim could not load sort_by_color.usd: missing asset trays/blue_tray.usd. Re-export the scene and try again.",
  }),
]

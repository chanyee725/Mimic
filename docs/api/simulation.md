# Simulation

Isaac Sim runs on the station's local RTX 4090, for **evaluation only**. The user builds environments and registers each one as a
folder under the environments folder (setting `training.simEnvsPath`, default `sim/envs` in this repo). A saved model is loaded into
any compatible environment and rolled out many times. Web: `api/simulation.ts`, Simulation pages.

## Environment folder

```
sim/envs/<env-id>/
  env.yaml      required — manifest (below)
  scene.usd     required — Isaac Sim stage (referenced by env.yaml `scene`)
  success.py    required — `check(state) -> (done: bool, success: bool, reason: str | None)`
  assets/       optional — USD sub-assets
```

```yaml
name: Tabletop, two blocks
task: stack-two-blocks          # optional link to a task id
description: Two 4 cm blocks on a 60×40 cm table.
robot: so101
scene: scene.usd
calibrated: true                # camera poses / FOV / joint limits matched to the real rig
cameras:
  top: { resolution: [640, 480], fps: 30 }
  wrist: { resolution: [640, 480], fps: 30 }
action_dim: 6
episode:
  max_seconds: 40
  success: success.py:check
```

Scanning rules: every direct sub-folder of the environments folder is one environment (id = folder name; names starting with
`_` or `.` are skipped). It is `invalid` (with `error`) when `env.yaml` is missing or not valid YAML, a required key is missing,
or a referenced file (`scene`, the `success` module) does not exist.

## Types

```ts
SimEnv = {
  id: string; name: string; path: string; description?: string; taskId?: string
  cameras: string[]; actionDim: number; maxSeconds: number; calibrated: boolean
  state: "ready" | "invalid"; error?: string
  manifest: string                             // env.yaml text
  files: { path: string; sizeKB: number }[]
  registeredAt: string; updatedAt: string      // first seen / folder mtime
}
CompatIssue = { level: "error" | "warn"; text: string }
ModelCompat = { modelId: string; usable: boolean; issues: CompatIssue[] }

Randomization = "none" | "low" | "high"
SimEpisode = { index: number; seed: number; success: boolean; seconds: number; reason?: string }
SimJob = {
  id: string; modelId: string; envId: string
  status: "running" | "queued" | "done" | "failed" | "stopped"
  episodes: number; randomization: Randomization; seedStart: number; maxSeconds: number
  startedAt?: string; elapsedS?: number; etaS?: number
  done: number; succeeded: number               // counts (episodes are paged separately)
  failureReasons: Record<string, number>
  error?: string
}
```

Compatibility (same rule as `web/src/domain/simulation.ts#envCompat`): the model's task cameras must all be in `cameras`
(error), `actionDim` must equal the rig's joint count (error), an invalid environment is an error, `calibrated: false` is a warning.

## Endpoints

| Method | Path | Body | Returns | Web |
| --- | --- | --- | --- | --- |
| GET | `/sim/envs?state=` | | `SimEnv[]` | `listSimEnvs()` |
| GET | `/sim/envs/{id}` | | `SimEnv` | `getSimEnv(id)` |
| POST | `/sim/envs/rescan` | | `{ dir: string; scannedAt: string; envs: SimEnv[] }` | Rescan |
| GET | `/sim/envs/{id}/compat` | | `ModelCompat[]` for every saved model | Environment → Models |
| GET | `/sim/config` | | `{ envsDir: string; gpu: { id, name, vram, busyBy?: string } }` | `getSimEnvsDir()`, `SIM_GPU`, GPU row |
| GET | `/sim/jobs?status=` | | `SimJob[]` newest first | `listSimJobs()` |
| GET | `/sim/jobs/{id}` | | `SimJob` | `getSimJob(id)` |
| POST | `/sim/jobs` | `{ modelId, envId, episodes, seedStart, maxSeconds, randomization }` | `202 SimJob` (running, or queued when the GPU is busy); 422 if the model is not compatible | Start / Queue evaluation |
| POST | `/sim/jobs/{id}/stop` | | `SimJob` (stopped); 409 if not active | Stop evaluation / Cancel |
| GET | `/sim/jobs/{id}/episodes?result=success\|fail&limit=&cursor=` | | `Page<SimEpisode>` by index | Episodes table |
| GET | `/sim/jobs/{id}/episodes/{index}/video/{camera}` | | `video/mp4` | Rollout replay |

Live: `sim.updated` (status, counts, eta) and `sim.episode` (each finished episode) events; live Isaac Sim view over WebRTC.

## Changes from the web mocks

`results` (all episodes inline) → counts on the job plus the paged `/episodes`; `elapsed` / `eta` → seconds.

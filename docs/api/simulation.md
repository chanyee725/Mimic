# Simulation

Isaac Sim 5.1.0 runs on the station or on a remote sim server (see **Isaac Sim server** below) and is used for both
**data** and **evaluation**:

- Data: a task tagged **Isaac Sim** stores one registered environment (`envId`, [tasks.md](tasks.md)); the rig's real
  leader arm drives the simulated follower and Capture records the same MCAP, tagged with `simEnv`
  ([recordings.md](recordings.md)). The bridge is pending: Capture on an Isaac Sim task answers 503 for now.
- Evaluation: a saved model is loaded into any compatible environment and rolled out many times.

The user builds environments and registers each one as a folder under the environments folder (`VLA_SIM_ENVS_DIR` in
`.env` or the environment, default `sim/envs` in this repo). Web: `api/simulation.ts`; environments are managed on the
**Environments** page (register, check, open), tasks pick one, and sim evaluation runs as the **Isaac Sim** target of
Evaluate (`/evaluate?target=sim`, job page `/evaluate/sim/<jobId>`).

**Evaluation is not connected yet**: environments are scanned for real and can be opened in Isaac Sim, but there are no jobs (lists are `[]`,
job routes 404) and a valid `POST /sim/jobs` returns `503 { "error": { "message": "Isaac Sim runner is not connected" } }`.

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

- Required keys: `name`, `scene`, `cameras` (non-empty mapping of camera keys, or a list), `action_dim` (positive integer),
  `episode.success` (`<file>:<function>`). Optional: `task`, `description`, `robot`, `calibrated` (default `false`),
  `episode.max_seconds` (default 40).
- `error` texts: `env.yaml not found`, `env.yaml: invalid YAML (line N)`, `env.yaml: missing key 'action_dim'`,
  `env.yaml: scene.usd not found`, `env.yaml: success.py not found (expected success.py:check)`.
- Invalid folders still report whatever parsed (`name` falls back to the id) plus `manifest` and `files`.
- `files`: every file under the folder (recursive, posix paths, sorted), skipping hidden files and `__pycache__`;
  `sizeKB` is rounded up.
- `registeredAt`: first time the backend saw the folder (per process). `updatedAt`: latest mtime of the folder or any file in it
  (editing `env.yaml` in place does not change the folder's own mtime).
- The list is cached; `GET /sim/envs` returns the last scan (done at startup), `POST /sim/envs/rescan` refreshes it.
  Folder: `VLA_SIM_ENVS_DIR` (backend config).

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
The model's cameras come from its task, its action size from `len(rig.joints)` of the task's rig. `/compat` is ordered like the
web: usable models for the environment's task, other usable ones, then blocked ones.

## Endpoints

| Method | Path | Body | Returns | Web |
| --- | --- | --- | --- | --- |
| GET | `/sim/envs?state=` | | `SimEnv[]` | `listSimEnvs()` |
| GET | `/sim/envs/{id}` | | `SimEnv` | `getSimEnv(id)` |
| POST | `/sim/envs/rescan` | | `{ dir: string; scannedAt: string; envs: SimEnv[] }` | Rescan |
| GET | `/sim/envs/{id}/compat` | | `ModelCompat[]` for every saved model | Environment → Models |
| GET | `/sim/config` | | `{ envsDir: string; gpu: { id, name, vram, busyBy?: string } \| null }` — first GPU from nvidia-smi, `null` when none is detected | `getSimEnvsDir()`, GPU row |
| GET | `/sim/jobs?status=` | | `SimJob[]` newest first | `listSimJobs()` |
| GET | `/sim/jobs/{id}` | | `SimJob` | `getSimJob(id)` |
| POST | `/sim/jobs` | `{ modelId, envId, episodes, seedStart, maxSeconds, randomization }` | `503` (runner not connected; later `202 SimJob`); 422 if the model / env is unknown or not compatible | Start / Queue evaluation |
| POST | `/sim/jobs/{id}/stop` | | `SimJob` (stopped); 409 if not active | Stop evaluation / Cancel |
| GET | `/sim/jobs/{id}/episodes?result=success\|fail&limit=&cursor=` | | `Page<SimEpisode>` by index | Episodes table |
| GET | `/sim/jobs/{id}/episodes/{index}/video/{camera}` | | `video/mp4` | Rollout replay |

Notes:

- `POST /sim/jobs`: an unknown `modelId` / `envId` or an incompatible pair is `422 validation_error`; for an incompatible pair
  `details.issues` is the `CompatIssue[]`. Warnings alone don't block. Body defaults: `episodes` 50 (1–10000), `seedStart` 1000,
  `maxSeconds` 40, `randomization` `"low"`. A valid request then gets 503 until the runner exists.
- One job holds the GPU at a time (`/sim/config` `gpu.busyBy`). When the running job ends (done, failed, stopped), the oldest
  queued job starts.
- Episode video is `501 not_implemented` until Isaac Sim is connected; unknown job / episode index / camera is 404.

Live: `sim.updated` (status, counts, eta) and `sim.episode` (each finished episode) events; live Isaac Sim view over WebRTC.

## Isaac Sim server

`sim/runner/server.py` (stdlib only) fronts one Isaac Sim app process (`sim/runner/app.py`, run with the Python that has
`isaacsim` — `cd sim && uv sync` installs 5.1.0 into `sim/.venv`). Settings → Connection → Isaac Sim (`connection.isaac`,
[settings.md](settings.md)) picks where it runs:

- `local`: the backend starts the server on `127.0.0.1:<port>` with `<python>` the first time it is needed. The server is
  detached, so it outlives backend reloads and is found again by its port; `POST /sim/runner/stop` stops only the app.
  Its log and the received environments live in `~/.cache/mimic-sim/`.
- `remote`: the server runs on a sim server (`sim/.venv/bin/python sim/runner/server.py --host 0.0.0.0 --port 8211`) and the
  backend calls `url`. Opening an environment sends its folder as tar.gz, so the server needs no copy of `sim/envs`.

`display` (`window` | `headless`) is used when the app starts; starting with the other display restarts the app.

```ts
SimRunnerApp = { state: "stopped" | "starting" | "running" | "exited"; display: "window" | "headless" | null;
                 pid: number | null; scene: string | null /* open env id */; error: string | null }
SimRunner    = { mode: "local" | "remote"; display: "window" | "headless"; url: string; reachable: boolean;
                 app: SimRunnerApp | null /* null when the server is not reachable */ }
```

| Method | Path | Body | Returns | Web |
| --- | --- | --- | --- | --- |
| GET | `/sim/runner` | | `SimRunner` | Environment detail status |
| POST | `/sim/runner/start` | `{ display? }` | `SimRunner`; 503 if the local Python is missing or the server is unreachable | — |
| POST | `/sim/runner/stop` | | `SimRunner` (app stopped) | Stop |
| POST | `/sim/envs/{id}/open` | `{ display? }` | `SimRunner` (app `starting` until the scene is open); 409 for an invalid env, 503 as above, 502 when the server rejects it | Open in Isaac Sim |

Server API (backend ↔ server, JSON): `GET /health` → `{ version, app: SimRunnerApp }`; `POST /app/start {display}`;
`POST /app/stop`; `POST /scene?env=<id>&display=` with the tar.gz body. The app answers `GET /state` and `POST /open {path}`
on a private port only the server uses.

## Changes from the web mocks

`results` (all episodes inline) → counts on the job plus the paged `/episodes`; `elapsed` / `eta` → seconds. No seed jobs;
`gpu` is detected (nullable) instead of the `SIM_GPU` constant.

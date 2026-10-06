# Simulation

Isaac Sim 5.1.0 runs on the station or on a remote sim server (see **Isaac Sim server** below) and is used for both
**data** and **evaluation**:

- Data: a task tagged **Isaac Sim** stores one registered environment (`envId`, [tasks.md](tasks.md)); the rig's real
  leader arm drives the simulated follower and Capture records the same MCAP, tagged with `simEnv`
  ([recordings.md](recordings.md)). The bridge is pending: Capture on an Isaac Sim task answers 503 for now.
- Evaluation: a saved model is loaded into an environment and rolled out many times.

An environment is a **USD stage**: no manifest, no success script, no ready / invalid state. To add one, copy a
`.usd` / `.usda` / `.usdc` / `.usdz` file (or a folder holding one with its assets) into the environments folder
(`VLA_SIM_ENVS_DIR` in `.env` or the environment, default `sim/envs`, empty in this repo), then **Rescan**. Web:
`api/simulation.ts`; environments are managed on the **Environments** page (rescan, open in Isaac Sim, delete), tasks pick one, and sim evaluation runs as the **Isaac Sim** target of Evaluate (`/evaluate?target=sim`, job page
`/evaluate/sim/<jobId>`).

**Evaluation is not connected yet**: environments are scanned for real and can be opened in Isaac Sim, but there are no jobs (lists are `[]`,
job routes 404) and a valid `POST /sim/jobs` returns `503 { "error": { "message": "Isaac Sim runner is not connected" } }`.

## Environments

```
sim/envs/
  table.usda              a top-level stage file: id "table"
  kitchen/                a folder: id "kitchen"
    scene.usd             its stage (scene.<ext> first, else the only top-level USD file)
    assets/…              sub-assets the stage references
```

Scanning rules:

- Stage files are `.usd`, `.usda`, `.usdc` or `.usdz` (any case). Names starting with `_` or `.` are skipped.
- A top-level stage file is one environment (id = file stem, `scene` = the file name, `files` = just that file).
- A folder is one environment when it holds a stage: `scene.<ext>` first, else its only top-level stage file. A folder with
  no stage, or several and none named `scene`, is not listed. `files`: every file under it (recursive, posix paths, sorted),
  skipping hidden files and `__pycache__`.
- A folder wins over a top-level file with the same id. `sizeKB` (each file and the total) is rounded up.
- `registeredAt`: first time the backend saw it (per process). `updatedAt`: latest mtime of the file, or of the folder and
  any file in it.
- The list is cached; `GET /sim/envs` returns the last scan (done at startup); rescan and delete refresh it.

## Types

```ts
SimEnv = {
  id: string; name: string                     // name = id
  path: string                                 // absolute path of the file or folder
  scene: string                                // stage file, relative to the folder (the file name for a top-level file)
  sizeKB: number
  files: { path: string; sizeKB: number }[]
  registeredAt: string; updatedAt: string
}
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

## Endpoints

| Method | Path | Body | Returns | Web |
| --- | --- | --- | --- | --- |
| GET | `/sim/envs` | | `SimEnv[]` by id | `listSimEnvs()` |
| GET | `/sim/envs/{id}` | | `SimEnv`; 404 if unknown | `getSimEnv(id)` |
| POST | `/sim/envs/rescan` | | `{ dir: string; scannedAt: string; envs: SimEnv[] }` | Rescan |
| DELETE | `/sim/envs/{id}` | | 204; deletes the file or folder. 404 if unknown; 409 with `details.tasks` while a task's `envId` uses it | Delete |
| GET | `/sim/config` | | `{ envsDir: string; gpu: { id, name, vram, busyBy?: string } \| null }` — first GPU from nvidia-smi, `null` when none is detected | `getSimEnvsDir()`, GPU row |
| GET | `/sim/jobs?status=` | | `SimJob[]` newest first | `listSimJobs()` |
| GET | `/sim/jobs/{id}` | | `SimJob` | `getSimJob(id)` |
| POST | `/sim/jobs` | `{ modelId, envId, episodes, seedStart, maxSeconds, randomization }` | `503` (runner not connected; later `202 SimJob`); 422 if the model / env is unknown | Start / Queue evaluation |
| POST | `/sim/jobs/{id}/stop` | | `SimJob` (stopped); 409 if not active | Stop evaluation / Cancel |
| GET | `/sim/jobs/{id}/episodes?result=success\|fail&limit=&cursor=` | | `Page<SimEpisode>` by index | Episodes table |
| GET | `/sim/jobs/{id}/episodes/{index}/video/{camera}` | | `video/mp4` | Rollout replay |

Notes:

- `POST /sim/jobs`: an unknown `modelId` / `envId` is `422 validation_error`. Body defaults: `episodes` 50 (1–10000), `seedStart` 1000,
  `maxSeconds` 40, `randomization` `"low"`. A valid request then gets 503 until the runner exists.
- One job holds the GPU at a time (`/sim/config` `gpu.busyBy`). When the running job ends (done, failed, stopped), the oldest
  queued job starts.
- Episode video is `501 not_implemented` until Isaac Sim is connected; unknown job / episode index is 404, and so is a camera that is not one of the model's task cameras.

Live: `sim.envs` (`{ envs }` after a rescan or delete), `sim.updated` (status, counts, eta) and `sim.episode` (each finished episode) events; live Isaac Sim view over WebRTC.

## Isaac Sim server

`sim/runner/server.py` (stdlib only) fronts one Isaac Sim app process (`sim/runner/app.py`, run with the Python that has
`isaacsim` — `cd sim && uv sync` installs 5.1.0 into `sim/.venv`). Settings → Connection → Isaac Sim (`connection.isaac`,
[settings.md](settings.md)) picks where it runs:

- `local`: the backend starts the server on `127.0.0.1:<port>` with `<python>` the first time it is needed. The server is
  detached, so it outlives backend reloads and is found again by its port; `POST /sim/runner/stop` stops only the app.
  Its log and the received environments live in `~/.cache/mimic-sim/`.
- `remote`: the server runs on a sim server (`sim/.venv/bin/python sim/runner/server.py --host 0.0.0.0 --port 8211`) and the
  backend calls `url`. Opening an environment sends its folder (or its single stage file) as tar.gz, so the server needs no copy of `sim/envs`.

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
| POST | `/sim/envs/{id}/open` | `{ display? }` | `SimRunner` (app `starting` until the scene is open); 404 for an unknown env, 503 as above, 502 when the server rejects it | Open in Isaac Sim |

Server API (backend ↔ server, JSON): `GET /health` → `{ version, app: SimRunnerApp }`; `POST /app/start {display}`;
`POST /app/stop`; `POST /scene?env=<id>&scene=<file>&display=` with the tar.gz body (the folder's files, or the single
stage file); the server extracts it and opens `<file>` (default `scene.usd`; a path leaving the folder is refused). The app answers `GET /state` and `POST /open {path}`
on a private port only the server uses.

## Changes from the web mocks

`results` (all episodes inline) → counts on the job plus the paged `/episodes`; `elapsed` / `eta` → seconds. No seed jobs;
`gpu` is detected (nullable) instead of the `SIM_GPU` constant.

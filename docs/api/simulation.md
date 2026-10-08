# Simulation

Isaac Sim 5.1.0 runs on the station or on a remote sim server (see **Isaac Sim server** below) and is used for both
**data** and **evaluation**:

- Data: a task tagged **Isaac Sim** stores one registered environment (`envId`, [tasks.md](tasks.md)); the rig's real
  leader arm drives the simulated follower and Capture records the same MCAP, tagged with `simEnv`
  ([recordings.md](recordings.md)). The bridge is pending: Capture on an Isaac Sim task answers 503 for now.
- Evaluation: a saved model is loaded into an environment and rolled out many times.

An environment is a **Python script** whose `build(scene)` lays out the stage from the shared assets in `sim/assets/`
and places the robot (`sim/runner/scene.py`, example `sim/examples/envs/`): no manifest, no success script, no
ready / invalid state. Which robots it is for is a **robot tag** set on the Environments page (`<sim folder>/envs.yaml`).
To add one, copy a `<id>.py` file (or a folder holding `env.py`) into the environments folder
(`envs/` in the sim folder: `VLA_SIM_DIR` in `.env` or the environment, default `data/sims` — the one part of the data folder committed to git), then **Rescan**. Web:
`api/simulation.ts`; environments are managed on the **Environments** page (rescan, open in Isaac Sim, delete), tasks pick one, and sim evaluation runs as the **Isaac Sim** target of Evaluate (`/evaluate?target=sim`, job page
`/evaluate/sim/<jobId>`).

**Evaluation is not connected yet**: environments are scanned for real and can be opened in Isaac Sim, but there are no jobs (lists are `[]`,
job routes 404) and a valid `POST /sim/jobs` returns `503 { "error": { "message": "Isaac Sim runner is not connected" } }`.

## Environments

```
data/sims/
  robots/                 robot USDs: <id>.usd|usda|usdc or <id>/<id>.usd… (GET /sim/robots)
  tools/                  end-effector USDs (hands, grippers): same layout (GET /sim/tools); scene.tool(<id>) places one
  envs.yaml               robot tags: { <env id>: { robots: [<robot id>, …] } } — written by PATCH /sim/envs/{id}
  envs/
    table.py              a top-level script: id "table"
    table.png             its thumbnail (same stem)
    kitchen/              a folder: id "kitchen"
      env.py              its script
      thumbnail.png       its thumbnail
      props/…             files of its own the script uses
```

A script defines `build(scene)`; `scene` starts with `/World`, a physics scene, lights and a floor:

```python
def build(scene):
    scene.add("table")                                   # sim/assets/table, origin at its bottom centre
    scene.add("cube", pos=(0, 0.08, 0.75), color=(0.8, 0.1, 0.1))
    scene.robot(pos=(0, -0.2, 0.75), yaw=180)            # the tagged robot, pinned to the world
```

`scene.add(asset, pos, yaw, name, scale, color)` references `sim/assets/<asset>/<asset>.usd[a]` at `/World/<name>`;
`scene.robot(pos, yaw, name=None)` references the robot (the env's first robot tag unless `name` is given) at
`/World/Robot`, moves its articulation root onto that prim and adds a fixed joint to the world (an error without a tag); `scene.stage` is the `pxr` stage for anything else. Metres, Z up, yaw in
degrees about Z.

Scanning rules:

- Scripts are `.py` files. Names starting with `_` or `.` are skipped.
- A top-level script is one environment (id = file stem, `script` = the file name, `files` = just that file).
- A folder is one environment when it holds `env.py` (`script: "env.py"`); a folder without one is not listed. `files`: every file under it (recursive, posix paths, sorted),
  skipping hidden files and `__pycache__`.
- Duplicate ids (`x.py` and `x/env.py`): the folder wins; the other is skipped with a warning in the backend log.
- `robots` comes from `envs.yaml`. `rigIds`: configured rigs whose follower types (rig file `robot.type`, e.g.
  `so101_follower`) are all in `robots`; every rig when `robots` is empty. A task or sim job whose rig is not in `rigIds`
  is refused (422 "environment '<id>' is for <robots>, not rig '<rig>'"). Robot ids are named after the LeRobot follower
  type they simulate.
- Thumbnail: `<stem>.png|jpg|jpeg|webp` beside a script, or `thumbnail.png|jpg|jpeg|webp` inside an environment
  folder (`thumbnail: true`, served by `/sim/envs/{id}/thumbnail`). Images are never environments. `sizeKB` (each file and the total) is rounded up.
- `registeredAt`: first time the backend saw it (per process). `updatedAt`: latest mtime of the file, or of the folder and
  any file in it.
- The list is cached; `GET /sim/envs` returns the last scan (done at startup); rescan and delete refresh it.

## Types

```ts
SimEnv = {
  id: string; name: string                     // name = id
  path: string                                 // absolute path of the file or folder
  script: string                               // "env.py" for a folder, the file name for a top-level script
  sizeKB: number
  files: { path: string; sizeKB: number }[]
  registeredAt: string; updatedAt: string
  robots: string[]                             // robot tags; [] = untagged, fits any rig
  rigIds: string[]                             // configured rigs that fit the tags
  thumbnail: boolean                           // an image is served by /sim/envs/{id}/thumbnail
}
SimAsset = {                                   // a robot (robots/) or tool (tools/) USD
  id: string
  path: string                                 // absolute path of the root USD
  sizeKB: number
  files: { path: string; sizeKB: number }[]    // relative to its folder; the file name for a single file
  updatedAt: string
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
| PATCH | `/sim/envs/{id}` | `{ robots: string[] }` | `SimEnv` with the new tags (`[]` clears them); 404 if unknown, 422 with `details.robots` for a robot not under `robots/` | Robots checkboxes |
| GET | `/sim/robots` | | `SimAsset[]` by id | Robots checkboxes, Robots tab |
| GET | `/sim/tools` | | `SimAsset[]` by id (tools/) | Tools tab |
| GET | `/sim/envs/{id}/thumbnail` | | the image (`image/png`, `image/jpeg`, `image/webp`); 404 when the env is unknown or has none | Environment thumbnail |
| POST | `/sim/envs/rescan` | | `{ dir: string; scannedAt: string; envs: SimEnv[] }` | Rescan |
| DELETE | `/sim/envs/{id}` | | 204; deletes the file or folder. 404 if unknown; 409 with `details.tasks` while a task's `envId` uses it | Delete |
| GET | `/sim/config` | | `{ envsDir: string; gpu: { id, name, vram, busyBy?: string } \| null }` — first GPU from nvidia-smi, `null` when none is detected | `getSimEnvsDir()`, GPU row |
| GET | `/sim/jobs?status=` | | `SimJob[]` newest first | `listSimJobs()` |
| GET | `/sim/jobs/{id}` | | `SimJob` | `getSimJob(id)` |
| POST | `/sim/jobs` | `{ modelId, envId, episodes, seedStart, maxSeconds, randomization }` | `503` (runner not connected; later `202 SimJob`); 422 if the model / env is unknown, or the env's robot tags don't fit the rig of the model's task | Start / Queue evaluation |
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
  backend calls `url`. Opening an environment sends its folder (or its single script) and its first tagged robot's USD (its folder when it has one) as tar.gz laid out like `data/sims` (`envs/…`, `robots/…`), so the server needs no copy of `data/sims`.

`display` (`window` | `headless`) is used when the app starts; starting with the other display restarts the app.

```ts
SimRunnerApp = { state: "stopped" | "starting" | "running" | "exited"; display: "window" | "headless" | null;
                 device: "gpu" | "cpu" | null; pid: number | null; scene: string | null /* open env id */; error: string | null }
SimRunner    = { mode: "local" | "remote"; display: "window" | "headless"; device: "gpu" | "cpu"; url: string;
                 reachable: boolean;
                 app: SimRunnerApp | null /* null when the server is not reachable */ }
```

| Method | Path | Body | Returns | Web |
| --- | --- | --- | --- | --- |
| GET | `/sim/runner` | | `SimRunner` | Environment detail status |
| POST | `/sim/runner/start` | `{ display? }` | `SimRunner`; 503 if the local Python is missing or the server is unreachable | — |
| POST | `/sim/runner/stop` | | `SimRunner` (app stopped) | Stop |
| POST | `/sim/robots/{id}/open` | `{ display? }` | `SimRunner`; opens the robot alone, pinned at the origin on an empty stage (app scene `robot-<id>`); 404 for an unknown robot | Robots tab: Open in Isaac Sim |
| POST | `/sim/tools/{id}/open` | `{ display? }` | `SimRunner`; opens the tool alone, pinned 0.3 m above the floor (app scene `tool-<id>`); 404 for an unknown tool | Tools tab: Open in Isaac Sim |
| POST | `/sim/envs/{id}/open` | `{ display? }` | `SimRunner` (app `starting` until the scene is open; a failing script shows as `app.error`); 404 for an unknown env, 422 when the tagged robot has no USD, 503 as above, 502 when the server rejects it | Open in Isaac Sim |

Server API (backend ↔ server, JSON): `GET /health` → `{ version, app: SimRunnerApp }`; `POST /app/start {display, device}`;
`POST /app/stop`; `POST /scene?env=<id>&script=<file>&robot=<robot id>&display=&device=` with the tar.gz body (laid out like `data/sims`:
`envs/<env>…`, `robots/…`); the server extracts it and has the app build a new stage from `<file>` (default `env.py`; a path
leaving the folder is refused). Assets come from the server's own `sim/assets/`. The app answers `GET /state` and
`POST /open {path, root, robot}` on a private port only the server uses; an exception in the script is kept as `app.error` (the
app keeps running). Server `version` is 2.

Physics device (`connection.isaac.device`, default `gpu`): the backend sends it with every start / open; the server
restarts the app when the display or the device differs from the running one. `gpu` starts the app with
`active_gpu` / `physics_gpu` 0 and `/physics/cudaDevice` 0, and turns on PhysX GPU dynamics and the GPU broadphase in every
`PhysicsScene` of a built stage, written to the session layer; `cpu` keeps PhysX on the CPU (`MBP` broadphase). Rendering always uses the
NVIDIA GPU.

## Changes from the web mocks

`results` (all episodes inline) → counts on the job plus the paged `/episodes`; `elapsed` / `eta` → seconds. No seed jobs;
`gpu` is detected (nullable) instead of the `SIM_GPU` constant.

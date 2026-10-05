# CLAUDE.md

Guidance for working in this repository.

## Language

- Talk to the user in Korean.
- **Code comments, identifiers, commit messages and this file: English.**
- `README.md` files stay in Korean.
- UI copy: buttons and labels in English; on-screen descriptions and hints in Korean. Do not translate on-screen Korean text when editing comments.

## Project

- **Mimic** (formerly VLA Data Pipeline, then Apprentice): a station tool for SO-101 teleoperation: capture → review → LeRobot conversion → training → evaluation. Keep the `VLA_*` env prefix and the `vla.*` MCAP schema names (existing `.env` files and recordings use them). See [README.md](README.md) for the flow.
- Recording: cameras at 30 fps, action at 60 Hz (leader → follower). The raw format is one MCAP file per episode.
- Conversion: LeRobot v3.0 only. The dataset fps follows the camera fps and action is downsampled (no time-alignment options).
- Model: SmolVLA (`lerobot/smolvla_base`) only. Training runs on the local GPU or RunPod.
- Simulation: Isaac Sim 5.1.0, evaluation only (no data generation, no RunPod). It runs on this station or a remote sim server (Settings → Connection → Isaac Sim, local / remote, window / headless) through `sim/runner/server.py`; `cd sim && uv sync` installs it into `sim/.venv`. The user builds environments and registers each as a folder (`env.yaml`, `scene.usd`, `success.py`) under the environments folder (`VLA_SIM_ENVS_DIR`, default `sim/envs`); a saved model is loaded into any compatible environment (cameras and action size must match).
- Backend (planned): FastAPI (REST), gRPC (60 Hz robot data), WebRTC (cameras). The frontend reads everything from the backend through React Query hooks in `web/src/api`; there is no dummy data — the station starts empty and every list comes from files under `data/`. On the Rigs page devices are reached through LeRobot (port scan, connection test, arm calibration — `docs/api/rigs.md`); streaming drivers, the camera pipeline, the RunPod trainer and the sim / eval runners don't exist yet: devices report \"off\" until tested. Capture runs the rig's teleop and records its real joints plus the task cameras' JPEG frames into the episode MCAP (Review plays them as MP4 built on demand). Local training runs `lerobot-train` as a detached process followed through its log (`data/training/<job>/`, `docs/api/training.md`); starting a RunPod job, evaluation or a sim job returns 503.
- A data glove (tactile / flex / IMU) is planned later; keep it out of the UI for now.

## Privacy

- Operators are pseudonymous IDs (`OP-01`). Never put real names, emails or account handles in code, mock data, commits or docs.
- API keys and tokens show only their last 4 characters in the UI and are stored only in the repo-root `.env` on the backend (git-ignored) — never in browser storage, YAML files or commits.

## Git

- Branches: `main` ← `develop` ← `feat/web` ← work branches (`feat/web-*`, `fix/web-*`, `refactor/web-*`, `chore/*`, `docs/*`).
- Start every task on a new branch from `feat/web` and merge it back with `git merge --no-ff`.
- **Only merge into `develop` / `main` or push when the user asks.**
- English Conventional Commits, split by feature, ending with a `Co-Authored-By:` trailer.
- Avoid `git stash` and `git reset --mixed` (see the Vite note below).

## backend/

- FastAPI, Python 3.12 (uv), Pydantic v2, black (line length 100), pytest. LeRobot (+ torch) comes with the default `hardware` dependency group and is imported lazily; tests run with `VLA_DEVICE_DRIVER=none` and a fake driver (`tests/support.py`) — never real ports. API spec: `docs/api/` — update it with every endpoint change.
- `cd backend && uv sync && uv run uvicorn app.main:app --reload` (port 8000); `uv run pytest`; `uv run black .` before committing.
- Layered layout (one file per area in each layer, same file name across layers):
  ```
  app/
    main.py                  create_app, mounts api_router under /api/v1
    configs/config.py        Config (env VLA_*), REPO_ROOT
    api/deps.py              shared params: Pagination (limit/cursor), TaskIdFilter (?taskId)
    api/v1/__init__.py       api_router (health + every feature package's router)
    api/v1/<feature>/        __init__.py: router (tags, prefix per include); one module per
                             sub-resource (e.g. training/jobs.py) — HTTP only: params, status codes, call a service
    schemas/<area>.py        request / response bodies (CamelModel); schemas/common.py: CamelModel, Page, paginate
    models/<area>.py         domain entities kept by services (CamelModel)
    services/<area>.py       state + rules, one file per area; an area with helpers becomes a package
                             services/<area>/ (training, simulation, capture, tasks, realtime, settings, recordings, rigs) whose
                             __init__.py re-exports the public functions
    seeds/                   load(); data/*.json — defaults only (settings parts, shortcuts, training options)
    rpc/                     gRPC: gen/ (generated), servicer.py, server.py
    core/                    errors, events bus, storage (YAML files under config.data_dir)
    utils/                   domain-free helpers: time (now, ISO, set_clock for tests), paths, ids, rng
  tests/<area>/, tests/utils/
  ```
- Two folders, no Storage setting. Config folder (`VLA_CONFIG_DIR`, default `config/`, committed — the station's setup): `settings/<part>.yaml` (huggingface, runpod, connection, notifications — editable values only, no `version`, live state or secrets), `calibration/{robots|teleoperators}/<class>/<calibration_id>.json` (LeRobot calibration files; the driver points `HF_LEROBOT_CALIBRATION` here) and `rigs/<id>.yaml` (hand-written robot / device / cameras / rates, also the list of devices — `docs/api/rigs.md`; the Rigs page writes picked ports into it in place; no rig seeds, so a new config folder needs these files); `app.core.storage` routes paths starting with `rigs/`, `settings/`, `calibration/` here and moves old `data/<area>/` folders in on startup. Data folder (`VLA_DATA_DIR`, default `data/`, git-ignored as a whole — only what the web produces): `tasks/<id>.yaml`, `recordings/<task-id>/ep_<NNNN>.mcap` (joints + camera JPEG frames) + `.yaml` sidecar (the index) + `ep_<NNNN>.<key>.mp4` (playback cache), `training/<job-id>/` (job.yaml, train.log, metrics.jsonl, lerobot output/), `datasets/<ns>/<name>/` (real LeRobot v3.0 folders written with pyarrow and PyAV — camera video as H.264, checked in tests with `LeRobotDataset`, but the writer never imports `lerobot`; Convert and Merge run in a background thread into a `.partial-*` folder), `models/<id>/`. Raw keys live in the repo-root `.env` (`HF_TOKEN`, `RUNPOD_API_KEY`, `SLACK_WEBHOOK_URL`; 0600, git-ignored, never returned by the API; see `.env.example`), read from the environment first; `config.env_file_path` points at it. Task `collected`, sessions and the dashboard are computed from recordings. The local GPU is detected with nvidia-smi. Writes go through `app.core.storage`. Tests start from an empty data folder and a config folder with only `tests/fixtures/rigs/*.yaml`; create tasks / devices / recordings with the conftest fixtures and helpers (`task`, `devices_online`, `record`, `add_tasks`, `tests/support.py`) and an empty temp `.env` — never the real `.env`.
- Routers never hold state or rules; services never import FastAPI routers. Cross-area reads go through `app.services.<area>`. Date, path, id and seeded-random helpers live in `app.utils` — don't re-implement them in a service.
- Errors via `ApiError` / `not_found` / `conflict` (uniform `{"error": {...}}` body). Large lists use `paginate()`. Publish changes on `app.core.events.bus`.
- Comments: short, English. No PII; secrets are write-only.
- Branches: `feat/backend` ← `feat/backend-*`.
- Isaac Sim environments live in `sim/envs/<env-id>/` (see `sim/README.md`).

## web/ commands

```sh
cd web
export PATH=~/.nvm/versions/node/v24.18.0/bin:$PATH   # Node 24
npm run dev          # port 5173
npm run check        # typecheck + oxlint + prettier --check — always before committing
npm run format       # prettier --write src
```

- Style: no semicolons, double quotes, 140 columns (`.prettierrc`). `src/components/ui` is excluded from formatting.
- **Stale Vite modules:** after branch switches, merges or bulk edits the dev server often serves old modules and pages go blank ("does not provide an export named …"). Run `find src -type f -exec touch {} +`, check again, and restart the dev server if needed.
- Before reporting, open every page in a headless browser and confirm there are no console errors.

## web/ structure and rules

```
src/
  app/                 routes.tsx, nav.ts, layout.tsx
  features/<name>/     page.tsx (XxxPage, composition only) · components/ · hooks/use-*.ts · lib.ts (helpers, status→tone maps, constants, local types; becomes lib/ with an index.ts when it grows past ~200 lines)
  components/ui/       owned by the shadcn CLI — never hand-edit (theme via index.css tokens / data-slot rules, behaviour via wrappers)
  components/layout/   page-layout.tsx: Page, Panel, PanelLink
  components/common/   domain-free building blocks: StatusDot, StatStrip, Segmented, SearchInput, EmptyState, ProgressBar,
                       DetailList, ProgressRing, HfBadge, LinkButton, SettingsSection
  components/pickers/  shared pickers that know domain data: TaskPicker, ModelPickerDialog
  components/robot/    VideoTile, JointPlots, plot-canvas.ts (canvas drawing helpers)
  hooks/               use-hotkeys, use-draft-on-open, use-mobile
  domain/              entity types + pure rules (Task, Rig, Recording, Dataset, Model, TrainJob, … · successRate, isActive, jobPct)
  api/                 React Query hooks over the backend (client.ts, query.ts keys, events.ts WebSocket) — the only data source
  lib/                 domain-free helpers: utils (cn), format (time, size, price, plural)
```

- Named exports only. Inside a feature use relative imports; never import from another feature — anything used in two places moves to `components/common` (or `pickers`) or `lib`.
- Use `LinkButton` for links styled as buttons (not `buttonVariants` on a `Link`).
- Import order: external → `@/components/ui` → `@/components/layout` / `common` / `pickers` / `robot` → `@/api` → `@/domain` → `@/hooks` → `@/lib` → relative.
- Before writing new UI or helpers, check the shared components, `lib/format` and `use-hotkeys`. Don't rebuild tab bars, search fields, empty states, progress bars or time formatting.
- Types come from `@/domain/<entity>` (they mirror the backend JSON; optional fields are `T | null`), data from `@/api/<module>` hooks. Handle loading and error states; actions are mutations that invalidate their area. Dev: run the backend on :8000 (or set `VITE_API_TARGET`).

## UI

- Light theme only, desktop only (check at 1280×720 to 1920×1080). No mobile work.
- Pretendard font. Pages use the `Page` + `Panel` frame; status is a `StatusDot` (dot + text) rather than coloured pills; thin borders, no shadows or gradients.
- Prefer lists and tables over card grids. Plan for search, filters and paging on long lists — episodes and datasets can reach tens of thousands.
- Time-series charts follow Capture's JointPlots look (canvas, one metric per cell, latest value top right).

# CLAUDE.md

Guidance for working in this repository.

## Language

- Talk to the user in Korean.
- **Code comments, identifiers, commit messages and this file: English.**
- `README.md` files stay in Korean.
- UI copy: buttons and labels in English; on-screen descriptions and hints in Korean. Do not translate on-screen Korean text when editing comments.

## Project

- A station tool for SO-101 teleoperation: capture → review → LeRobot conversion → training → evaluation. See [README.md](README.md) for the flow.
- Recording: cameras at 30 fps, action at 60 Hz (leader → follower). The raw format is one MCAP file per episode.
- Conversion: LeRobot v3.0 only. The dataset fps follows the camera fps and action is downsampled (no time-alignment options).
- Model: SmolVLA (`lerobot/smolvla_base`) only. Training runs on the local GPU or RunPod.
- Simulation: Isaac Sim on the local RTX 4090, evaluation only (no data generation, no RunPod). The user builds environments and registers each as a folder (`env.yaml`, `scene.usd`, `success.py`) under the environments folder (`VLA_SIM_ENVS_DIR`, default `sim/envs`); a saved model is loaded into any compatible environment (cameras and action size must match).
- Backend (planned): FastAPI (REST), gRPC (60 Hz robot data), WebRTC (cameras). The frontend reads everything from the backend through React Query hooks in `web/src/api`; mock data lives in the backend seeds (`backend/app/seeds/data`).
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

- FastAPI, Python 3.12 (uv), Pydantic v2, black (line length 100), pytest. API spec: `docs/api/` — update it with every endpoint change.
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
    seeds/                   load(); data/*.json (the mock data); seeds/<area>.py converters
    rpc/                     gRPC: gen/ (generated), servicer.py, server.py
    core/                    errors, events bus, storage (YAML files under config.data_dir)
    utils/                   domain-free helpers: time (now, ISO, set_clock for tests), paths, ids, rng
  tests/<area>/, tests/utils/
  ```
- Station config persists as YAML under `data/` (`VLA_DATA_DIR`), committed to git: `settings/<part>.yaml` (huggingface, runpod, storage, connection, notifications — editable values only, no `version`, live state or secrets) and `rigs/<id>.yaml` (only `so101-kit`; hand-written robot / device / cameras / rates, also the list of devices — format in `docs/api/rigs.md`). Raw keys live in the repo-root `.env` (`HF_TOKEN`, `RUNPOD_API_KEY`, `SLACK_WEBHOOK_URL`; 0600, git-ignored, never returned by the API; see `.env.example`), read from the environment first; `config.env_file_path` points at it. Video / recording data (`data/recordings/`, `data/videos/`) is git-ignored. Recordings saved by Capture or imported go to the raw folder (Settings `storage.raw_path`, default `data/recordings`, relative to the repo root) as `<task-id>/ep_<NNNN>.mcap` plus a `.yaml` sidecar (the index), loaded on start next to the seed mocks (`docs/api/recordings.md`). A missing file/folder is seeded from `seeds/data` once; after that the files win and hand edits load on restart. Writes go through `app.core.storage`. Tasks, live device state and everything else stay in memory (seeds). Tests get a fresh data folder (raw folder pinned to `<data>/recordings`) and an empty temp `.env` per test, with the secret env vars removed (tests/conftest.py) — never the real `.env`.
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

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
- Simulation: Isaac Sim on the local RTX 4090, evaluation only (no data generation, no RunPod).
- Backend (planned): FastAPI (REST), gRPC (60 Hz robot data), WebRTC (cameras). The frontend currently runs on mocks in `web/src/dummy`, read through `web/src/api`.
- A data glove (tactile / flex / IMU) is planned later; keep it out of the UI for now.

## Privacy

- Operators are pseudonymous IDs (`OP-01`). Never put real names, emails or account handles in code, mock data, commits or docs.
- API keys and tokens show only their last 4 characters in the UI and are stored on the backend only — never in browser storage.

## Git

- Branches: `main` ← `develop` ← `feat/web` ← work branches (`feat/web-*`, `fix/web-*`, `refactor/web-*`, `chore/*`, `docs/*`).
- Start every task on a new branch from `feat/web` and merge it back with `git merge --no-ff`.
- **Only merge into `develop` / `main` or push when the user asks.**
- English Conventional Commits, split by feature, ending with a `Co-Authored-By:` trailer.
- Avoid `git stash` and `git reset --mixed` (see the Vite note below).

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
  api/                 data access: listX() / getX(id) / config exports / useRecordings — the only layer that touches mocks
  dummy/               mock data only (lint blocks imports from anywhere except src/api)
  lib/                 domain-free helpers: utils (cn), format (time, size, price, plural)
```

- Named exports only. Inside a feature use relative imports; never import from another feature — anything used in two places moves to `components/common` (or `pickers`) or `lib`.
- Use `LinkButton` for links styled as buttons (not `buttonVariants` on a `Link`).
- Import order: external → `@/components/ui` → `@/components/layout` / `common` / `pickers` / `robot` → `@/api` → `@/domain` → `@/hooks` → `@/lib` → relative.
- Before writing new UI or helpers, check the shared components, `lib/format` and `use-hotkeys`. Don't rebuild tab bars, search fields, empty states, progress bars or time formatting.
- Types come from `@/domain/<entity>`, data from `@/api/<module>`. Call api functions inside components, hooks or small functions (not at module top level) so they can become async query hooks when the backend lands. Connecting FastAPI / gRPC / WebRTC should only change `src/api`.

## UI

- Light theme only, desktop only (check at 1280×720 to 1920×1080). No mobile work.
- Pretendard font. Pages use the `Page` + `Panel` frame; status is a `StatusDot` (dot + text) rather than coloured pills; thin borders, no shadows or gradients.
- Prefer lists and tables over card grids. Plan for search, filters and paging on long lists — episodes and datasets can reach tens of thousands.
- Time-series charts follow Capture's JointPlots look (canvas, one metric per cell, latest value top right).

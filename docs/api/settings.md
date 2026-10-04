# Settings

Station settings, secrets and connection checks. Web: `api/settings.ts`, Settings page (one Save per section).

## Types

```ts
Secret    = { set: boolean; last4?: string }          // derived from .env; raw values are write-only
ConnState = "ok" | "error" | "unknown"
Settings  = { version: number } & {
  integrations: {
    hf:     { token: Secret; namespace; privateByDefault; state: ConnState }
    runpod: { apiKey: Secret; region; volume; monthlyBudget; idleAlertMin; spentThisMonth: number | null; state: ConnState }
  }
  connection: { api: { url; state; latencyMs? }; grpc: { url; state; latencyMs? }; webrtc: { stun; turn; state } }
  notifications: { slackWebhook: Secret; events: { key; label; on: boolean }[] }
}
SecretName = "hf_token" | "runpod_api_key" | "slack_webhook"
TestTarget = "hf" | "runpod" | "api" | "grpc" | "webrtc" | "slack"
Disk = { totalGB: number; parts: { key: "raw" | "datasets" | "models" | "other"; label: string; gb: number }[] }
// totalGB = size of the disk holding the data folder; free = totalGB - sum(parts.gb)
```

## Storage

- `config/settings/<part>.yaml`, one file per part, snake_case keys, hand-editable and committed:
  `huggingface` (integrations.hf), `runpod`, `connection`, `notifications`.
  Files hold only editable values: no `version` (kept in memory, 1 after each start), no live fields
  (`state`, `latency_ms`, `spent_this_month`) and no secrets, so connection tests and key changes never touch them.
- On load the seed document is overlaid with each file (nested objects merge, other values replace), so missing keys and live
  fields get seed values. Live fields start honest: every `state` is `unknown` until a connection test runs, `latencyMs` is
  `null` and `spentThisMonth` is `null` (RunPod spend is not tracked yet). A missing file is written from the seeds; an invalid one is left untouched and that part uses the seeds
  (a warning is logged) until it is fixed or that part is saved.
- A save rewrites only the files whose content changed.
- There is no storage section. Two folders, both relative to the repo root unless absolute:
  - config folder (`VLA_CONFIG_DIR`, default `config`, committed): `rigs/`, `settings/`, `calibration/` — the station's setup.
  - data folder (`VLA_DATA_DIR`, default `data`, git-ignored): what the web produces — `tasks/`, `recordings/` (MCAP +
    sidecars), `datasets/`, `models/`. The backend config exposes them as `config.recordings_dir`, `config.datasets_dir`
    and `config.models_dir`.
- Secrets live in the repo-root `.env` (`config.env_file_path`; git-ignored, mode 0600) under the names other tools read:

  | Secret name | `.env` / environment key |
  | --- | --- |
  | `hf_token` | `HF_TOKEN` |
  | `runpod_api_key` | `RUNPOD_API_KEY` |
  | `slack_webhook` | `SLACK_WEBHOOK_URL` |

  On load each value comes from the process environment first, then `.env`; the `{set, last4}` in `Settings` is computed from it.
  PUT / DELETE edit only that key's line in `.env` (the file is created if missing; comments and `VLA_*` lines stay) and the
  in-memory value. A value set in the environment still wins after the next restart. Raw values never leave the backend.
- Migration: an old `data/settings.yaml` is split into the part files when `config/settings/` does not exist yet, then deleted.
  An old `data/secrets.yaml` is copied into `.env` (keys not already set) and deleted. The dropped `station.yaml`,
  `training.yaml` and `storage.yaml` part files are deleted, and stale secret entries in part files are removed on load.
- The simulation environments folder comes from `VLA_SIM_ENVS_DIR` (default `sim/envs`), not from settings.
- Disk, shortcuts and versions are not stored.

## Endpoints

| Method | Path | Body | Returns | Web |
| --- | --- | --- | --- | --- |
| GET | `/settings` | | `Settings` | `getSettings()` |
| PATCH | `/settings/{section}` | `{ version, ...sectionFields }` (secrets and read-only fields like `state`, `spentThisMonth` are ignored) | `Settings`; 409 stale version | Save changes |
| PUT | `/settings/secrets/{name}` | `{ value }` (min 8 chars) | `Secret` | Set / Replace key |
| DELETE | `/settings/secrets/{name}` | | `Secret` (`set: false`) | Remove key |
| POST | `/settings/test/{target}` | | `{ state: ConnState; latencyMs?: number; detail?: string }` | Test / Send test |
| GET | `/settings/disk` | | `Disk` — real usage (see below) | `getDiskUsage()` |
| GET | `/settings/shortcuts` | | `{ page; keys: { keys: string[]; action }[] }[]` (static UI reference) | `getShortcuts()` |
| GET | `/settings/versions` | | `{ k: string; v: string }[]` — installed versions, in this order: `Python`, `FastAPI`, `Pydantic`, `mcap`, `lerobot` (`"not installed"` when missing) | `getVersions()` |

`section` ∈ `integrations | connection | notifications` (recording rates live on each rig; the old `station`, `training` and
`storage` sections are gone and answer 422 like any unknown section).

Disk: `totalGB` is the size of the disk holding the data folder (`shutil.disk_usage`). Parts, in this order: `raw`
(Recordings: `<data>/recordings`), `datasets` (`<data>/datasets`), `models` (`<data>/models`) — the summed file sizes of
each folder (0 when missing) — and `other` = the rest of the disk's used space. Free space = `totalGB - sum(gb)`. Values are
GiB rounded to 3 decimals.

Rules:

- PATCH merges: nested objects merge key by key, other values replace. Keys may be camelCase or snake_case;
  unknown keys are ignored. Read-only: `state`, `latencyMs`, `spentThisMonth`, secrets (`token`, `apiKey`, `slackWebhook`).
- `notifications.events` is matched by `key`; only `on` is editable (unknown key → 422).
- A missing `version` or an invalid section value → 422 (`details.errors[].loc` starts with `body`); a stale version → 409 with
  the whole document in `details.current`. Success bumps `version` and publishes `settings.updated` (data `Settings`).
- Unknown `section`, secret `name` or test `target` in the path → 422.
- Secret writes do not bump `version`; they reset the related integration `state` to `unknown`. Raw values stay in `.env` and backend memory only.
- `POST /settings/test/{target}` stores the result in the matching `state` (and `latencyMs` for api / grpc):
  - `api` → `ok` (the request reached the API; no latency).
  - `grpc` → a real TCP connect to `connection.grpc.url` (1 s timeout): `ok` with the measured `latencyMs`, else `error`
    with `detail`.
  - `webrtc` → `error` ("Camera pipeline is not implemented yet").
  - `hf` / `runpod` / `slack` → `error` with `detail` when the related secret is missing; otherwise `ok` with
    `detail: "Key is set (not verified online)"` (no online call yet, no latency).

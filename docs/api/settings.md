# Settings

Station settings, secrets and connection checks. Web: `api/settings.ts`, Settings page (one Save per section).

## Types

```ts
Secret    = { set: boolean; last4?: string }          // write-only values
ConnState = "ok" | "error" | "unknown"
Settings  = { version: number } & {
  station: { name; id; timezone; operators: { id; role: "operator" | "admin" }[] }
  integrations: {
    hf:     { token: Secret; namespace; privateByDefault; state: ConnState }
    runpod: { apiKey: Secret; region; volume; monthlyBudget; idleAlertMin; spentThisMonth; state: ConnState }
    wandb:  { apiKey: Secret; project; enableByDefault; state: ConnState }
  }
  storage:    { rawPath; datasetsPath; modelsPath; warnAtPct; deleteRejected; deleteRejectedAfterDays; keepCheckpoints }
  connection: { api: { url; state; latencyMs? }; grpc: { url; state; latencyMs? }; webrtc: { stun; turn; state } }
  recording:  { actionHz; videoFps; mcapCompression: "zstd" | "lz4" | "none"; chunkMB; codec: "av1" | "h264"; crf }
  training:   { lerobotCommit; defaultCompute: "local" | "runpod"; saveFreq; simGpu; simEnvsPath }
  notifications: { slackWebhook: Secret; events: { key; label; on: boolean }[] }
}
SecretName = "hf_token" | "runpod_api_key" | "wandb_api_key" | "slack_webhook"
TestTarget = "hf" | "runpod" | "wandb" | "api" | "grpc" | "webrtc" | "slack"
Disk = { totalGB: number; parts: { key: "raw" | "datasets" | "models" | "other"; label: string; gb: number }[] }
```

## Endpoints

| Method | Path | Body | Returns | Web |
| --- | --- | --- | --- | --- |
| GET | `/settings` | | `Settings` | `getSettings()` |
| PATCH | `/settings/{section}` | `{ version, ...sectionFields }` (secrets and read-only fields like `state`, `spentThisMonth`, `station.id` are ignored) | `Settings`; 409 stale version | Save changes |
| PUT | `/settings/secrets/{name}` | `{ value }` (min 8 chars) | `Secret` | Set / Replace key |
| DELETE | `/settings/secrets/{name}` | | `Secret` (`set: false`) | Remove key |
| POST | `/settings/test/{target}` | | `{ state: ConnState; latencyMs?: number; detail?: string }` | Test / Send test |
| GET | `/settings/disk` | | `Disk` | `getDiskUsage()` |
| GET | `/settings/shortcuts` | | `{ page; keys: { keys: string[]; action }[] }[]` | `getShortcuts()` |
| GET | `/settings/versions` | | `{ k: string; v: string }[]` (web app, backend, lerobot, CUDA driver, Isaac Sim) | `getVersions()` |

`section` ∈ `station | integrations | storage | connection | recording | training | notifications`.
Operators: IDs must match `^OP-\d{2}$`, unique; at least one admin.

Rules:

- PATCH merges: nested objects merge key by key, other values (incl. `operators`) replace. Keys may be camelCase or snake_case;
  unknown keys are ignored. Read-only: `state`, `latencyMs`, `spentThisMonth`, secrets (`token`, `apiKey`, `slackWebhook`), `station.id`.
- `notifications.events` is matched by `key`; only `on` is editable (unknown key → 422).
- A missing `version` or an invalid section value → 422 (`details.errors[].loc` starts with `body`); a stale version → 409 with
  the whole document in `details.current`. Success bumps `version` and publishes `settings.updated` (data `Settings`).
- Unknown `section`, secret `name` or test `target` in the path → 422.
- Secret writes do not bump `version`; they reset the related integration `state` to `unknown`. Raw values stay in backend memory only.
- `POST /settings/test/{target}` stores the result in the matching `state` (and `latencyMs` for api / grpc). The mock answers `ok`
  for api / grpc / webrtc, and for hf / runpod / wandb / slack when the related secret is set (else `error` with `detail`).

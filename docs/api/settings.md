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
Operators: IDs must match `^OP-\d{2}$`; at least one admin.

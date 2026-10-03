export type Secret = { set: boolean; last4?: string }

export type ConnState = "ok" | "error" | "unknown"

/** Station settings document; every section save sends `version` (stale → 409) */
export type Settings = {
  version: number
  station: { name: string; id: string; timezone: string; operators: { id: string; role: "operator" | "admin" }[] }
  integrations: {
    hf: { token: Secret; namespace: string; privateByDefault: boolean; state: ConnState }
    runpod: {
      apiKey: Secret
      region: string
      volume: string
      monthlyBudget: number
      idleAlertMin: number
      spentThisMonth: number
      state: ConnState
    }
    wandb: { apiKey: Secret; project: string; enableByDefault: boolean; state: ConnState }
  }
  storage: {
    rawPath: string
    datasetsPath: string
    modelsPath: string
    warnAtPct: number
    deleteRejectedAfterDays: number
    deleteRejected: boolean
    keepCheckpoints: number
  }
  connection: {
    api: { url: string; state: ConnState; latencyMs?: number }
    grpc: { url: string; state: ConnState; latencyMs?: number }
    webrtc: { stun: string; turn: string; state: ConnState }
  }
  recording: {
    actionHz: number
    videoFps: number
    mcapCompression: "zstd" | "lz4" | "none"
    chunkMB: number
    codec: "av1" | "h264"
    crf: number
  }
  training: { lerobotCommit: string; defaultCompute: "local" | "runpod"; saveFreq: number; simGpu: string; simEnvsPath: string }
  notifications: {
    slackWebhook: Secret
    events: { key: string; label: string; on: boolean }[]
  }
}

export type SettingsSection = Exclude<keyof Settings, "version">

type DeepPartial<T> = T extends unknown[] ? T : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T

/** Body of PATCH /settings/{section}: changed fields of that section plus the document version (nested objects merge) */
export type SettingsPatch<S extends SettingsSection = SettingsSection> = { version: number } & DeepPartial<Settings[S]>

export type SecretName = "hf_token" | "runpod_api_key" | "wandb_api_key" | "slack_webhook"

export type TestTarget = "hf" | "runpod" | "wandb" | "api" | "grpc" | "webrtc" | "slack"

export type ConnTestResult = { state: ConnState; latencyMs?: number; detail?: string }

export type DiskPartKey = "raw" | "datasets" | "models" | "other"

export type Disk = { totalGB: number; parts: { key: DiskPartKey; label: string; gb: number }[] }

/** Used share of the disk, 0–100 */
export const diskUsedPct = (disk: Disk) => (disk.totalGB > 0 ? (disk.parts.reduce((s, p) => s + p.gb, 0) / disk.totalGB) * 100 : 0)

export type ShortcutGroup = { page: string; keys: { keys: string[]; action: string }[] }

export type VersionRow = { k: string; v: string }

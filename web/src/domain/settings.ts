export type Secret = { set: boolean; last4?: string }

export type ConnState = "ok" | "error" | "unknown"

/** Station settings document; every section save sends `version` (stale → 409) */
export type Settings = {
  version: number
  integrations: {
    hf: { token: Secret; namespace: string; privateByDefault: boolean; state: ConnState }
    runpod: { apiKey: Secret; state: ConnState }
  }
  connection: { isaac: IsaacSettings }
  notifications: {
    slackWebhook: Secret
    events: { key: string; label: string; on: boolean }[]
  }
}

export type IsaacMode = "local" | "remote"
export type IsaacDisplay = "window" | "headless"
export type IsaacDevice = "gpu" | "cpu"

/** Isaac Sim server: started on this station (local) or a sim server's URL (remote) */
export type IsaacSettings = {
  mode: IsaacMode
  /** Window or headless when the app starts */
  display: IsaacDisplay
  /** PhysX device: GPU dynamics + broadphase (default) or CPU; the app restarts on a change */
  device: IsaacDevice
  /** Local: Python with isaacsim, relative to the repo root */
  python: string
  /** Local: server port on 127.0.0.1 */
  port: number
  /** Remote: http://host:port */
  url: string
  state: ConnState
  latencyMs?: number | null
}

export type SettingsSection = Exclude<keyof Settings, "version">

type DeepPartial<T> = T extends unknown[] ? T : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T

/** Body of PATCH /settings/{section}: changed fields of that section plus the document version (nested objects merge) */
export type SettingsPatch<S extends SettingsSection = SettingsSection> = { version: number } & DeepPartial<Settings[S]>

export type SecretName = "hf_token" | "runpod_api_key" | "slack_webhook"

export type TestTarget = "hf" | "runpod" | "isaac" | "slack"

export type ConnTestResult = { state: ConnState; latencyMs?: number | null; detail?: string | null }

export type DiskPartKey = "raw" | "datasets" | "models" | "other"

/** GiB; free space is totalGB minus the parts */
export type Disk = { totalGB: number; parts: { key: DiskPartKey; label: string; gb: number }[] }

/** Used share of the disk, 0–100 */
export const diskUsedPct = (disk: Disk) => (disk.totalGB > 0 ? (disk.parts.reduce((s, p) => s + p.gb, 0) / disk.totalGB) * 100 : 0)

export type ShortcutGroup = { page: string; keys: { keys: string[]; action: string }[] }

export type VersionRow = { k: string; v: string }

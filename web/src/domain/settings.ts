export type Secret = { set: boolean; last4?: string }

export type ConnState = "ok" | "error" | "unknown"

export type Settings = {
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

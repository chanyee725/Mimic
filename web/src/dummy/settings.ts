// Mock station settings. The backend (FastAPI) will own these and only return the last 4 chars of secrets.
// Operators are pseudonymous IDs only (no real names or emails).

import type { Settings } from "@/domain/settings"

export const SETTINGS: Settings = {
  station: {
    name: "Station 01",
    id: "st-01",
    timezone: "Asia/Seoul",
    operators: [
      { id: "OP-01", role: "admin" },
      { id: "OP-02", role: "operator" },
      { id: "OP-03", role: "operator" },
    ],
  },
  integrations: {
    hf: { token: { set: true, last4: "3kQz" }, namespace: "vla-lab", privateByDefault: true, state: "ok" },
    runpod: {
      apiKey: { set: true, last4: "9F2A" },
      region: "any",
      volume: "vla-datasets",
      monthlyBudget: 300,
      idleAlertMin: 15,
      spentThisMonth: 142.3,
      state: "ok",
    },
    wandb: { apiKey: { set: false }, project: "vla-smolvla", enableByDefault: false, state: "unknown" },
  },
  storage: {
    rawPath: "~/vla/raw",
    datasetsPath: "~/vla/datasets",
    modelsPath: "~/vla/models",
    warnAtPct: 85,
    deleteRejected: true,
    deleteRejectedAfterDays: 14,
    keepCheckpoints: 4,
  },
  connection: {
    api: { url: "http://localhost:8000", state: "ok", latencyMs: 4 },
    grpc: { url: "localhost:50051", state: "ok", latencyMs: 2 },
    webrtc: { stun: "stun:stun.l.google.com:19302", turn: "", state: "ok" },
  },
  recording: { actionHz: 60, videoFps: 30, mcapCompression: "zstd", chunkMB: 4, codec: "av1", crf: 30 },
  training: {
    lerobotCommit: "[COMMIT HASH]",
    defaultCompute: "local",
    saveFreq: 5000,
    simGpu: "RTX 4090 (cuda:0)",
    simEnvsPath: "~/vla/sim/envs",
  },
  notifications: {
    slackWebhook: { set: false },
    events: [
      { key: "train_done", label: "Training finished", on: true },
      { key: "train_failed", label: "Training failed", on: true },
      { key: "pod_idle", label: "RunPod pod still running after training", on: true },
      { key: "budget", label: "RunPod monthly budget reached 80%", on: true },
      { key: "disk", label: "Disk almost full", on: true },
      { key: "sim_done", label: "Simulation evaluation finished", on: false },
    ],
  },
}

/** Disk usage (GB) */
export const DISK = {
  totalGB: 2000,
  parts: [
    { key: "raw", label: "Raw MCAP", gb: 412 },
    { key: "datasets", label: "Datasets", gb: 96 },
    { key: "models", label: "Models", gb: 38 },
    { key: "other", label: "Other", gb: 74 },
  ],
}

/** Keyboard shortcut reference */
export const SHORTCUTS = [
  {
    page: "Capture",
    keys: [
      { keys: ["Space"], action: "Start or stop recording" },
      { keys: ["→"], action: "Save as success" },
      { keys: ["F"], action: "Save as fail" },
      { keys: ["P"], action: "Save as partial" },
      { keys: ["←"], action: "Re-record" },
      { keys: ["Esc"], action: "Discard" },
      { keys: ["1", "4"], action: "Mark subtask while recording" },
    ],
  },
  {
    page: "Review",
    keys: [
      { keys: ["Space"], action: "Play or pause" },
      { keys: ["←", "→"], action: "Seek 1 s (Shift: 5 s)" },
      { keys: ["Home", "End"], action: "Jump to start or end" },
    ],
  },
  {
    page: "Evaluate",
    keys: [
      { keys: ["Space"], action: "Run policy" },
      { keys: ["Esc"], action: "Stop" },
      { keys: ["S"], action: "Mark success" },
      { keys: ["F"], action: "Mark fail" },
    ],
  },
]

export const VERSIONS = [
  { k: "Web app", v: "0.1.0" },
  { k: "Backend", v: "0.1.0" },
  { k: "lerobot", v: "[COMMIT HASH]" },
  { k: "CUDA driver", v: "560.35" },
  { k: "Isaac Sim", v: "4.5" },
]

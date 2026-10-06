import type { Tone } from "@/components/common/status-dot"
import type { GpuStock, RunPodGpu, RunPodOptions, RunPodPhase, TrainJob } from "@/domain/training"

// RunPod (the hourly rate itself is runpodRate in @/domain/training)

/** Hours until the max runtime or the budget is hit, whichever comes first (0 = no limit) */
export function runpodCapHours(o: RunPodOptions, rate: number) {
  return o.budget ? Math.min(o.maxHours || Infinity, o.budget / rate) : o.maxHours
}

/** "Secure, on-demand, 1 GPU, stop after 6 h" */
export function runpodSummary(o: RunPodOptions) {
  return [
    o.cloud === "secure" ? "Secure cloud" : "Community cloud",
    o.pricing,
    `${o.gpuCount} GPU${o.gpuCount > 1 ? "s" : ""}`,
    o.maxHours ? `stop after ${o.maxHours} h` : "no time limit",
    o.budget ? `budget $${o.budget}` : "",
  ]
    .filter(Boolean)
    .join(", ")
}

export type Tier = "all" | "small" | "mid" | "large"

/** VRAM tiers in the GPU picker */
export const TIERS: { id: Tier; label: string; fits: (g: RunPodGpu) => boolean }[] = [
  { id: "all", label: "All", fits: () => true },
  { id: "small", label: "≤ 24 GB", fits: (g) => g.vramGB <= 24 },
  { id: "mid", label: "32–48 GB", fits: (g) => g.vramGB > 24 && g.vramGB <= 48 },
  { id: "large", label: "80 GB+", fits: (g) => g.vramGB > 48 },
]

export const GPU_STOCK: Record<GpuStock, { tone: Tone; label: string }> = {
  high: { tone: "ok", label: "Available" },
  low: { tone: "warn", label: "Low stock" },
  none: { tone: "muted", label: "Unavailable" },
}

/** VRAM that is tight for SmolVLA at the default batch size (rough) */
export const TIGHT_VRAM = 20

/** What a running RunPod job is doing, by phase */
export const RUNPOD_PHASES: Record<RunPodPhase, { label: string; hint: string }> = {
  "pushing dataset": { label: "Pushing dataset", hint: "데이터셋을 HF Hub 에 올리는 중" },
  "starting pod": { label: "Starting pod", hint: "pod 를 띄우는 중 (이미지 받기, 수 분)" },
  installing: { label: "Installing", hint: "LeRobot 설치 중" },
  downloading: { label: "Downloading", hint: "데이터셋 받는 중" },
  training: { label: "Training", hint: "학습 중" },
  uploading: { label: "Uploading", hint: "checkpoint 를 올리는 중" },
}

/** Phase label + hint of a running RunPod job, or null */
export function runpodPhase(job: Pick<TrainJob, "compute" | "status" | "phase">) {
  if (job.compute !== "runpod" || job.status !== "running" || !job.phase) return null
  return RUNPOD_PHASES[job.phase as RunPodPhase] ?? { label: job.phase, hint: job.phase }
}

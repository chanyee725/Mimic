import type { Tone } from "@/components/common/status-dot"
import type { GpuStock, RunPodGpu, RunPodOptions } from "@/domain/training"

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

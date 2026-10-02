import type { Tone } from "@/components/app/status-dot"
import { RUNPOD_PRICE_FACTOR, type Compute, type JobStatus, type RunPodOptions, type TrainJob } from "@/dummy/training"

export const JOB_STATUS: Record<JobStatus, { tone: Tone; label: string }> = {
  running: { tone: "info", label: "Running" },
  queued: { tone: "muted", label: "Queued" },
  done: { tone: "ok", label: "Done" },
  failed: { tone: "bad", label: "Failed" },
  stopped: { tone: "muted", label: "Stopped" },
}

export const COMPUTE_LABEL: Record<Compute, string> = { local: "Local GPU", runpod: "RunPod" }

export const jobPct = (j: TrainJob) => Math.round((j.step / j.total) * 100)

/** "Local GPU, RTX 4090" / "RunPod, A100 80GB, $1.89/h" */
export function computeText(j: TrainJob) {
  return [COMPUTE_LABEL[j.compute], j.gpu, j.pricePerHr && `$${j.pricePerHr.toFixed(2)}/h`].filter(Boolean).join(", ")
}

/** 옵션을 반영한 시간당 요금 */
export function runpodRate(base: number, o: RunPodOptions) {
  return base * o.gpuCount * RUNPOD_PRICE_FACTOR.cloud[o.cloud] * RUNPOD_PRICE_FACTOR.pricing[o.pricing]
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

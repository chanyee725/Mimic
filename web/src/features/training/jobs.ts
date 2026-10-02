import type { Tone } from "@/components/app/status-dot"
import type { Compute, JobStatus, TrainJob } from "@/dummy/training"

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

/** "2h 08m" → 시간(소수) */
export function hoursOf(elapsed?: string) {
  if (!elapsed) return 0
  const h = Number(elapsed.match(/(\d+)h/)?.[1] ?? 0)
  const m = Number(elapsed.match(/(\d+)m/)?.[1] ?? 0)
  return h + m / 60
}

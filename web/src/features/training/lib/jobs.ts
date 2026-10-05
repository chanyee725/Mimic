import type { Tone } from "@/components/common/status-dot"
import type { Compute, JobStatus, TrainJob } from "@/domain/training"
import { formatRate } from "@/lib/format"

// Job status and display

export const JOB_STATUS: Record<JobStatus, { tone: Tone; label: string }> = {
  running: { tone: "info", label: "Running" },
  queued: { tone: "muted", label: "Queued" },
  done: { tone: "ok", label: "Done" },
  failed: { tone: "bad", label: "Failed" },
  stopped: { tone: "muted", label: "Stopped" },
}

const COMPUTE_LABEL: Record<Compute, string> = { local: "Local GPU", runpod: "RunPod" }

/** "Local GPU, RTX 4090" / "RunPod, A100 80GB, $1.89/h" */
/** "Local GPU" / "RunPod, $1.31/hr" (without the GPU name) */
export function computeKind(j: TrainJob) {
  return [COMPUTE_LABEL[j.compute], j.pricePerHr && formatRate(j.pricePerHr)].filter(Boolean).join(", ")
}

export function computeText(j: TrainJob) {
  return [COMPUTE_LABEL[j.compute], j.gpu, j.pricePerHr && formatRate(j.pricePerHr)].filter(Boolean).join(", ")
}

/** Default model name when a checkpoint is saved to Models: "open-drawer job_036 (15k)" */
export const checkpointModelName = (j: TrainJob, step: number) => `${j.taskId} ${j.id} (${step >= 1000 ? `${step / 1000}k` : step})`

/**
 * Downloads a file from the station backend. Endpoints that are not ready (501) or fail
 * reject with the server's message so the caller can show it.
 */
export async function downloadFile(url: string) {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error?.message ?? res.statusText)
  }
  const blob = await res.blob()
  const name = res.headers.get("content-disposition")?.match(/filename="?([^";]+)"?/)?.[1] ?? "checkpoint.zip"
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

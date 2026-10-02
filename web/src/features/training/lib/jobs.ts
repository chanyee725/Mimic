import type { Tone } from "@/components/common/status-dot"
import { DATASETS } from "@/dummy/datasets"
import type { Checkpoint, Compute, JobStatus, TrainJob } from "@/dummy/training"
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

export const jobPct = (j: TrainJob) => Math.round((j.step / j.total) * 100)

/** "Local GPU, RTX 4090" / "RunPod, A100 80GB, $1.89/h" */
export function computeText(j: TrainJob) {
  return [COMPUTE_LABEL[j.compute], j.gpu, j.pricePerHr && formatRate(j.pricePerHr)].filter(Boolean).join(", ")
}

// Datasets that can be trained on: converted LeRobot datasets only
export const TRAINABLE = DATASETS.filter((d) => d.kind === "lerobot" && d.status === "ready").map((d) => d.repoId)

// Checkpoint

const SAVE_EVERY = 5000

/** Saved checkpoints plus save points passed while training */
export function checkpointsAt(job: TrainJob, step: number): Checkpoint[] {
  const saved = [...job.checkpoints]
  const last = saved.at(-1)?.step ?? 0
  for (let s = last + SAVE_EVERY; s <= step && job.status === "running"; s += SAVE_EVERY) {
    saved.push({ step: s, savedAt: "just now", sizeMB: saved[0]?.sizeMB ?? 1850 })
  }
  return saved
}

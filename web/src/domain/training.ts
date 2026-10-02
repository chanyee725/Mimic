export type JobStatus = "running" | "queued" | "done" | "failed" | "stopped"

export type Compute = "local" | "runpod"

/** RunPod pod state. idle = training finished but the pod is still up and billing */
export type PodState = {
  state: "running" | "idle" | "terminated"
  /** Terminate the pod when training ends */
  autoTerminate: boolean
  /** When it became idle / terminated */
  since?: string
  /** How long it has been idle */
  idleFor?: string
}

export type Checkpoint = { step: number; savedAt: string; sizeMB: number }

export type TrainJob = {
  id: string
  policy: string
  dataset: string
  taskId: string
  compute: Compute
  gpu: string
  pod?: string // RunPod pod name (runpod only)
  pricePerHr?: number // RunPod hourly price (USD)
  podState?: PodState // runpod only
  status: JobStatus
  step: number
  total: number
  batch: number
  epoch: number
  epochs: number
  startedAt?: string
  elapsed?: string // training time so far
  eta?: string
  checkpoints: Checkpoint[]
  error?: string
}

export type GpuStock = "high" | "low" | "none"

export type RunPodGpu = {
  name: string
  vramGB: number
  /** Secure cloud on-demand hourly price (USD, example values) */
  pricePerHr: number
  /** Also available on Community cloud */
  community: boolean
  stock: GpuStock
}

export type RunPodOptions = {
  cloud: "secure" | "community"
  pricing: "on-demand" | "spot"
  gpuCount: 1 | 2 | 4
  /** Stop training and terminate the pod after this many hours */
  maxHours: number
  /** Stop when the total cost exceeds this (USD, 0 = no limit) */
  budget: number
  diskGB: number
  volume: string
  region: string
  terminateOnFinish: boolean
  pushToHub: boolean
}

export const isActive = (j: TrainJob) => j.status === "running" || j.status === "queued"

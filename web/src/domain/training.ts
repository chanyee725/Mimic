// Training entities — wire shapes of docs/api/training.md

export type JobStatus = "running" | "queued" | "done" | "failed" | "stopped"

export type Compute = "local" | "runpod"

/** RunPod pod state. idle = training finished but the pod is still up and billing */
export type PodState = {
  state: "running" | "idle" | "terminated"
  /** Terminate the pod when training ends */
  autoTerminate: boolean
  /** When it became idle / terminated (ISO) */
  since?: string | null
  /** Seconds the pod has been idle */
  idleForS?: number | null
}

export type Checkpoint = { step: number; savedAt: string; sizeMB: number }

/** A lerobot-train flag value */
export type ParamValue = number | boolean | string

export type TrainJob = {
  id: string
  policy: string
  dataset: string
  taskId: string
  compute: Compute
  gpu: string
  /** RunPod pod name (runpod only) */
  pod?: string | null
  /** RunPod hourly rate with the options applied (USD) */
  pricePerHr?: number | null
  podState?: PodState | null
  status: JobStatus
  step: number
  total: number
  batch: number
  epoch: number
  epochs: number
  /** ISO timestamp */
  startedAt?: string | null
  /** Training time so far (s) */
  elapsedS?: number | null
  etaS?: number | null
  stepsPerS?: number | null
  /** RunPod cost so far (USD) */
  costUsd?: number | null
  /** lerobot-train flags that differ from the defaults */
  overrides: Record<string, ParamValue>
  checkpoints: Checkpoint[]
  error?: string | null
}

export type GpuStock = "high" | "low" | "none"

export type RunPodGpu = {
  name: string
  vramGB: number
  /** Secure cloud on-demand hourly price (USD) */
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

export type LocalGpu = { id: string; name: string; vram: string; busyBy?: string | null }

export type RunPodVolume = { id: string; label: string; note: string }

export type PriceFactor = {
  cloud: Record<RunPodOptions["cloud"], number>
  pricing: Record<RunPodOptions["pricing"], number>
}

export type RunPodConfig = {
  gpus: RunPodGpu[]
  regions: string[]
  volumes: RunPodVolume[]
  priceFactor: PriceFactor
  defaults: RunPodOptions
}

export type Param = { key: string; label: string; default: ParamValue; hint?: string | null }

export type ParamGroup = { title: string; params: Param[] }

/** GET /training/config */
export type TrainingConfig = {
  policy: string
  policyBase: string
  localGpus: LocalGpu[]
  runpod: RunPodConfig
  paramGroups: ParamGroup[]
  /** LeRobot datasets that are ready to train on */
  trainableDatasets: string[]
}

/** Body of POST /training/jobs and /training/command-preview */
export type JobCreate = {
  dataset: string
  compute: Compute
  /** Local GPU id or name, or a RunPod GPU name */
  gpu: string
  overrides?: Record<string, ParamValue>
  runpod?: RunPodOptions
}

export type CommandPreview = { command: string; ratePerHr?: number | null; capHours?: number | null; maxCostUsd?: number | null }

export type MetricSeries = "loss_raw" | "loss" | "grad_norm" | "lr" | "update_s" | "data_s" | "gpu_util" | "gpu_mem"

/** Metric history averaged into buckets of `every` steps */
export type Metrics = { fromStep: number; toStep: number; every: number; series: Record<MetricSeries, number[]> }

/** Progress in whole percent, at the job's own step or at a live step */
export const jobPct = (j: TrainJob, step = j.step) => (j.total ? Math.round((step / j.total) * 100) : 0)

export const isActive = (j: TrainJob) => j.status === "running" || j.status === "queued"

/** RunPod hourly rate for a GPU with the options applied: base × gpuCount × cloud × pricing factors */
export const runpodRate = (gpu: RunPodGpu, o: RunPodOptions, f: PriceFactor) =>
  gpu.pricePerHr * o.gpuCount * f.cloud[o.cloud] * f.pricing[o.pricing]

/** All lerobot-train params of the config, flattened */
export const allParams = (c: TrainingConfig) => c.paramGroups.flatMap((g) => g.params)

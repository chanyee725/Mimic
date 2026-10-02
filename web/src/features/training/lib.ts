import type { Tone } from "@/components/app/status-dot"
import { DATASETS } from "@/dummy/datasets"
import {
  POLICY_BASE,
  RUNPOD_PRICE_FACTOR,
  type Checkpoint,
  type Compute,
  type GpuStock,
  type JobStatus,
  type RunPodGpu,
  type RunPodOptions,
  type TrainJob,
} from "@/dummy/training"
import { formatRate } from "@/lib/format"

// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// RunPod

/** Hourly rate with the pod options applied */
export function runpodRate(base: number, o: RunPodOptions) {
  return base * o.gpuCount * RUNPOD_PRICE_FACTOR.cloud[o.cloud] * RUNPOD_PRICE_FACTOR.pricing[o.pricing]
}

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

// ---------------------------------------------------------------------------
// lerobot-train parameters. key is the CLI flag name as is (--key=value).
// Defaults follow lerobot TrainPipelineConfig / SmolVLAConfig; verify them against the pinned lerobot version.

export type ParamValue = number | boolean | string

export type Param = {
  key: string
  label: string
  default: ParamValue
  hint?: string
}

type ParamGroup = { title: string; params: Param[] }

export const PARAM_GROUPS: ParamGroup[] = [
  {
    title: "Training",
    params: [
      { key: "steps", label: "Steps", default: 100000 },
      { key: "batch_size", label: "Batch size", default: 8, hint: "줄이면 GPU 메모리를 덜 씁니다" },
      { key: "seed", label: "Seed", default: 1000 },
      { key: "num_workers", label: "Data loader workers", default: 4 },
    ],
  },
  {
    title: "Optimizer",
    params: [
      { key: "policy.optimizer_lr", label: "Learning rate", default: "1e-4" },
      { key: "policy.optimizer_weight_decay", label: "Weight decay", default: "1e-10" },
      { key: "policy.optimizer_grad_clip_norm", label: "Grad clip norm", default: 10 },
    ],
  },
  {
    title: "Scheduler",
    params: [
      { key: "policy.scheduler_warmup_steps", label: "Warmup steps", default: 1000 },
      { key: "policy.scheduler_decay_steps", label: "Decay steps", default: 30000 },
      { key: "policy.scheduler_decay_lr", label: "Final learning rate", default: "2.5e-6" },
    ],
  },
  {
    title: "Policy",
    params: [
      { key: "policy.chunk_size", label: "Action chunk size", default: 50 },
      { key: "policy.n_action_steps", label: "Action steps per inference", default: 50 },
      { key: "policy.freeze_vision_encoder", label: "Freeze vision encoder", default: true },
      { key: "policy.train_expert_only", label: "Train action expert only", default: true },
      { key: "policy.use_amp", label: "Mixed precision (AMP)", default: false },
    ],
  },
  {
    title: "Checkpoints and logging",
    params: [
      { key: "save_freq", label: "Save every (steps)", default: 20000 },
      { key: "log_freq", label: "Log every (steps)", default: 200 },
      { key: "wandb.enable", label: "Log to Weights & Biases", default: false },
    ],
  },
]

const ALL_PARAMS = PARAM_GROUPS.flatMap((g) => g.params)

export type Overrides = Record<string, ParamValue>

/** CLI flags for values that differ from the defaults */
export function overrideFlags(o: Overrides) {
  return ALL_PARAMS.filter((p) => p.key in o && o[p.key] !== p.default).map((p) => `--${p.key}=${o[p.key]}`)
}

/** lerobot-train command for display (one flag per line) */
export function trainCommand(dataset: string, flags: string[]) {
  return ["lerobot-train", `--policy.path=${POLICY_BASE}`, `--dataset.repo_id=${dataset}`, ...flags].join(" \\\n  ")
}

/** Values passed to the confirm dialog before training starts */
export type TrainingPlan = {
  dataset: string
  compute: "local" | "runpod"
  gpu: string
  /** Job id holding the local GPU, if busy (the new job is queued) */
  queuedBehind?: string
  runpod?: { options: RunPodOptions; rate: number; capHours: number }
  flags: string[]
}

// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Values logged every training step (mock).
// The real app fills them from lerobot-train step logs (loss, grad_norm, lr, update_s, data_s) and nvidia-smi.

const SERIES = ["loss_raw", "loss", "grad_norm", "lr", "update_s", "data_s", "gpu_util", "gpu_mem"] as const
type SeriesKey = (typeof SERIES)[number]

export type JobRun = {
  /** Number of logged steps (0..count-1 are filled) */
  count: number
  data: Record<SeriesKey, Float32Array>
  /** Fills the log up to (not including) the target step */
  advanceTo: (target: number) => void
}

const PEAK_LR = 1e-4
const DECAY_LR = 2.5e-6
const WARMUP = 1000
const DECAY_STEPS = 30000

/** Seeded random (the same job always gets the same curves) */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seedOf(id: string) {
  let h = 7
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}

export function createRun(job: TrainJob): JobRun {
  const data = Object.fromEntries(SERIES.map((k) => [k, new Float32Array(job.total)])) as JobRun["data"]
  const run: JobRun = { count: 0, data, advanceTo: () => {} }
  const rand = rng(seedOf(job.id))
  const a100 = job.gpu.includes("A100") || job.gpu.includes("H100")
  let ema = 0

  const step = (s: number) => {
    const noise = () => rand() - 0.5
    const raw = Math.max(0.01, 0.06 + 0.95 * Math.exp(-s / 2800) + noise() * (0.04 + 0.12 * Math.exp(-s / 4000)))
    ema = s === 0 ? raw : ema + 0.02 * (raw - ema)
    const lr =
      s < WARMUP
        ? (PEAK_LR * (s + 1)) / WARMUP
        : DECAY_LR + (PEAK_LR - DECAY_LR) * 0.5 * (1 + Math.cos((Math.PI * Math.min(s - WARMUP, DECAY_STEPS)) / DECAY_STEPS))
    const spike = rand() < 0.004
    data.loss_raw[s] = raw
    data.loss[s] = ema
    data.grad_norm[s] = 0.35 + 2.4 * Math.exp(-s / 2400) + Math.abs(noise()) * 0.4 + (spike ? 2 + rand() * 3 : 0)
    data.lr[s] = lr
    data.update_s[s] = (a100 ? 0.52 : 0.78) + noise() * 0.06
    data.data_s[s] = 0.035 + Math.abs(noise()) * 0.02 + (rand() < 0.01 ? 0.2 + rand() * 0.3 : 0)
    data.gpu_util[s] = Math.min(100, 93 + noise() * 8 - (data.data_s[s] > 0.1 ? 25 : 0))
    data.gpu_mem[s] = (a100 ? 38.2 : 19.6) + noise() * 0.3
  }

  run.advanceTo = (target) => {
    const end = Math.min(target, job.total)
    for (let s = run.count; s < end; s++) step(s)
    run.count = Math.max(run.count, end)
  }
  return run
}

// ---------------------------------------------------------------------------
// Metric plots

type MetricLine = {
  key: SeriesKey
  label: string
  /** CSS variable name (--series-1, ...) */
  color: string
  dashed?: boolean
  /** Draw raw values faintly (under the smoothed line) */
  faint?: boolean
}

export type Metric = {
  title: string
  lines: MetricLine[]
  format: (v: number) => string
  /** Pin the y axis minimum to 0 */
  zero?: boolean
  /** y axis maximum (e.g. 100%) */
  max?: number
}

export const METRICS: Metric[] = [
  {
    title: "Loss",
    lines: [
      { key: "loss_raw", label: "raw", color: "--series-1", faint: true },
      { key: "loss", label: "loss (smoothed)", color: "--series-1" },
    ],
    format: (v) => v.toFixed(3),
    zero: true,
  },
  {
    title: "Gradient norm",
    lines: [{ key: "grad_norm", label: "grad_norm", color: "--series-2" }],
    format: (v) => v.toFixed(2),
    zero: true,
  },
  {
    title: "Learning rate",
    lines: [{ key: "lr", label: "lr", color: "--series-4" }],
    format: (v) => (v === 0 ? "0" : v.toExponential(1)),
    zero: true,
  },
  {
    title: "Step time",
    lines: [
      { key: "update_s", label: "update", color: "--series-1" },
      { key: "data_s", label: "data", color: "--series-3", dashed: true },
    ],
    format: (v) => `${Math.round(v * 1000)} ms`,
    zero: true,
  },
  {
    title: "GPU utilization",
    lines: [{ key: "gpu_util", label: "util", color: "--series-5" }],
    format: (v) => `${v.toFixed(0)}%`,
    max: 100,
    zero: true,
  },
  { title: "GPU memory", lines: [{ key: "gpu_mem", label: "used", color: "--series-6" }], format: (v) => `${v.toFixed(1)} GB`, zero: true },
]

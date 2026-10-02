import type { TrainJob } from "@/domain/training"

// Values logged every training step (mock).
// The real app fills them from lerobot-train step logs (loss, grad_norm, lr, update_s, data_s) and nvidia-smi.

const SERIES = ["loss_raw", "loss", "grad_norm", "lr", "update_s", "data_s", "gpu_util", "gpu_mem"] as const
export type SeriesKey = (typeof SERIES)[number]

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

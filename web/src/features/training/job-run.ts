import { useEffect, useState } from "react"

import type { TrainJob } from "@/dummy/training"

// 학습 중 매 step 기록되는 값 (목업).
// 실제로는 lerobot-train 의 step 로그(loss, grad_norm, lr, update_s, data_s)와 nvidia-smi 값을 받아 채운다.

export const SERIES = ["loss_raw", "loss", "grad_norm", "lr", "update_s", "data_s", "gpu_util", "gpu_mem"] as const
export type SeriesKey = (typeof SERIES)[number]

export type JobRun = {
  /** 기록된 step 수 (0..count-1 이 채워져 있다) */
  count: number
  data: Record<SeriesKey, Float32Array>
  /** target step 직전까지 기록을 채운다 */
  advanceTo: (target: number) => void
}

const PEAK_LR = 1e-4
const DECAY_LR = 2.5e-6
const WARMUP = 1000
const DECAY_STEPS = 30000

/** 시드 고정 난수 (같은 Job 은 항상 같은 곡선) */
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

function parseDuration(s?: string) {
  if (!s) return 0
  const h = Number(s.match(/(\d+)h/)?.[1] ?? 0)
  const m = Number(s.match(/(\d+)m/)?.[1] ?? 0)
  return (h * 60 + m) * 60
}

export function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`
}

/**
 * Job 의 step 로그를 만든다. 돌고 있는 Job 은 실제 속도(남은 step / ETA)로 step 이 하나씩 늘어난다.
 * 그래프는 run.data 를 직접 읽고, React 는 step 이 바뀔 때만 다시 그린다.
 */
export function useJobRun(job: TrainJob) {
  const [run] = useState(() => {
    const r = createRun(job)
    r.advanceTo(job.step)
    return r
  })
  const [step, setStep] = useState(job.step)
  const live = job.status === "running"
  const etaSec = parseDuration(job.eta)
  const stepsPerSec = live && etaSec ? (job.total - job.step) / etaSec : 0

  useEffect(() => {
    if (!stepsPerSec) return
    const t0 = performance.now()
    const id = setInterval(() => {
      const target = job.step + Math.floor(((performance.now() - t0) / 1000) * stepsPerSec)
      if (target > run.count) {
        run.advanceTo(target)
        setStep(run.count)
      }
    }, 100)
    return () => clearInterval(id)
  }, [job, run, stepsPerSec])

  const done = step - job.step
  const elapsedSec = parseDuration(job.elapsed) + (stepsPerSec ? done / stepsPerSec : 0)
  const remainingSec = stepsPerSec ? (job.total - step) / stepsPerSec : 0
  return { run, step, live, stepsPerSec, elapsedSec, remainingSec }
}

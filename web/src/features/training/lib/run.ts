import type { Metrics, MetricSeries } from "@/domain/training"

// A job's metric log for the plots: the averaged history from /metrics plus live training.metrics samples.
// Arrays are appended in place so the plots can redraw without a React render per step.

const SERIES: MetricSeries[] = ["loss_raw", "loss", "grad_norm", "lr", "update_s", "data_s", "gpu_util", "gpu_mem"]

export type JobRun = {
  /** Step of each sample (x axis), ascending */
  steps: number[]
  data: Record<MetricSeries, number[]>
}

/** Number of samples in the run */
export const runCount = (run: JobRun) => run.steps.length

/** Last logged step, 0 when empty */
export const runLastStep = (run: JobRun) => run.steps.at(-1) ?? 0

/** Run from the bucketed history: bucket i covers steps fromStep + i·every … and is placed at its last step */
export function runFromMetrics(m: Metrics): JobRun {
  const n = Math.min(...SERIES.map((k) => m.series[k]?.length ?? 0))
  const steps = Array.from({ length: n }, (_, i) => Math.min(m.fromStep + (i + 1) * m.every, m.toStep))
  const data = Object.fromEntries(SERIES.map((k) => [k, (m.series[k] ?? []).slice(0, n)])) as JobRun["data"]
  return { steps, data }
}

/** Appends one live sample if it is newer than the last one. Returns whether it was added */
export function appendSample(run: JobRun, step: number, values: Partial<Record<MetricSeries, number>>) {
  if (step <= runLastStep(run)) return false
  run.steps.push(step)
  for (const k of SERIES) run.data[k].push(values[k] ?? run.data[k].at(-1) ?? 0)
  return true
}

/** A series value at (or just before) a step, undefined before the first sample */
export function valueAt(run: JobRun, key: MetricSeries, step: number) {
  let i = run.steps.length - 1
  while (i >= 0 && run.steps[i] > step) i--
  return i >= 0 ? run.data[key][i] : undefined
}

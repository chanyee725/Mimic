import type { MetricSeries } from "@/domain/training"

// Metric plots

type MetricLine = {
  key: MetricSeries
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

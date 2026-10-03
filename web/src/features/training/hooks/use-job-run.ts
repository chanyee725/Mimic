import { useEffect, useMemo, useState } from "react"

import { onServerEvent } from "@/api/events"
import { useJobMetrics } from "@/api/training"
import type { MetricSeries, TrainJob } from "@/domain/training"

import { appendSample, runFromMetrics, runLastStep, type JobRun } from "../lib"

type MetricsEvent = { jobId: string; step: number; values: Partial<Record<MetricSeries, number>> }

const EMPTY: JobRun = {
  steps: [],
  data: { loss_raw: [], loss: [], grad_norm: [], lr: [], update_s: [], data_s: [], gpu_util: [], gpu_mem: [] },
}

/**
 * The job's metric log: history from GET /metrics, then live `training.metrics` samples appended in place.
 * Plots read run.data directly; React only re-renders when the live step changes.
 */
export function useJobRun(job: TrainJob) {
  const metrics = useJobMetrics(job.id)
  // Rebuilt whenever the history is refetched (training.updated invalidates it), which also folds in the live samples
  const run = useMemo(() => (metrics.data ? runFromMetrics(metrics.data) : EMPTY), [metrics.data])
  const [liveStep, setLiveStep] = useState(0)
  const live = job.status === "running"

  useEffect(() => {
    if (!live || run === EMPTY) return
    return onServerEvent((e) => {
      if (e.type !== "training.metrics") return
      const d = e.data as MetricsEvent
      if (d.jobId === job.id && appendSample(run, d.step, d.values)) setLiveStep(d.step)
    })
  }, [job.id, live, run])

  const step = Math.max(job.step, liveStep, runLastStep(run))
  return { run, step, live, metrics }
}

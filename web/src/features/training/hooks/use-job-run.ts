import { useEffect, useRef, useState } from "react"

import type { TrainJob } from "@/dummy/training"
import { parseDuration } from "@/lib/format"

import { createRun, type JobRun } from "../lib"

/** A run filled with the steps logged so far */
function startRun(job: TrainJob) {
  const run = createRun(job)
  run.advanceTo(job.step)
  return run
}

/**
 * Builds the job's step log. A running job advances at its real speed (remaining steps / ETA).
 * Plots read run.data directly; React only re-renders when the step changes.
 */
export function useJobRun(job: TrainJob) {
  // The run is a set of typed arrays mutated in place, so it lives in a ref rather than state.
  // Plots read run.data directly, so nothing is copied or re-rendered per step (performance).
  const runRef = useRef<JobRun | null>(null)
  if (runRef.current === null) runRef.current = startRun(job)
  // Created once and never replaced, so reading it during render is safe
  // oxlint-disable-next-line react/refs
  const run = runRef.current
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

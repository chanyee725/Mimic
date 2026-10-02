import { useEffect, useRef, useState } from "react"

import type { TrainJob } from "@/dummy/training"
import { parseDuration } from "@/lib/format"

import { createRun, type JobRun } from "../lib"

/** 지금까지의 step 로그를 채운 run */
function startRun(job: TrainJob) {
  const run = createRun(job)
  run.advanceTo(job.step)
  return run
}

/**
 * Job 의 step 로그를 만든다. 돌고 있는 Job 은 실제 속도(남은 step / ETA)로 step 이 하나씩 늘어난다.
 * 그래프는 run.data 를 직접 읽고, React 는 step 이 바뀔 때만 다시 그린다.
 */
export function useJobRun(job: TrainJob) {
  // run 은 제자리에서 계속 늘어나는 typed array 묶음이라 state 가 아닌 ref 에 둔다.
  // 플롯이 run.data 를 직접 읽으므로 step 마다 복사하거나 다시 렌더할 필요가 없다 (성능)
  const runRef = useRef<JobRun | null>(null)
  if (runRef.current === null) runRef.current = startRun(job)
  // 처음 한 번 만든 뒤 바뀌지 않는 객체라 렌더 중에 읽어도 안전하다
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

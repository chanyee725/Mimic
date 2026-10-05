import { useEffect, useState } from "react"

import { useEvalRun as useEvalRunQuery, useEvalResult, useEvalRuns, useStartEvalRun, useStopEvalRun } from "@/api/evaluate"
import { isEvalActive, type EvalJudgement } from "@/domain/evaluate"
import { useHotkeys } from "@/hooks/use-hotkeys"

import { trialsOf, type RunPhase } from "../lib"

/**
 * Policy run on the robot, driven by the server: start → running (polled; the server moves it to judging at the
 * time limit) → judge. Judged runs of this session make up the trials list.
 */
export function useEvalRun({
  modelId,
  instruction,
  limitS,
  record,
}: {
  modelId: string
  instruction: string
  limitS: number
  record: boolean
}) {
  const runs = useEvalRuns(modelId)
  const listed = runs.data?.find(isEvalActive)
  const detail = useEvalRunQuery(listed?.id)
  // The polled run is fresher than the list entry
  const run = listed && detail.data?.id === listed.id ? detail.data : listed
  const startRun = useStartEvalRun()
  const stopRun = useStopEvalRun()
  const result = useEvalResult()
  const pending = startRun.isPending || stopRun.isPending || result.isPending
  const phase: RunPhase = !run || run.state === "done" ? "idle" : run.state
  const canStart = !!instruction.trim() && limitS > 0 && !pending && runs.isSuccess

  // Tick the clock between polls: server elapsed + time since it was fetched
  const fetchedAt = run && run === detail.data ? detail.dataUpdatedAt : runs.dataUpdatedAt
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (phase !== "running") return
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [phase])
  const elapsedS = !run ? 0 : phase === "running" ? Math.min(run.limitS, run.elapsedS + Math.max(0, now - fetchedAt) / 1000) : run.elapsedS

  // Only the last action's error is shown
  const resetErrors = () => [startRun, stopRun, result].forEach((m) => m.reset())
  const start = () => {
    if (!canStart) return
    resetErrors()
    startRun.mutate({ modelId, instruction: instruction.trim(), limitS, record })
  }
  const stop = () => {
    if (!run || pending) return
    resetErrors()
    stopRun.mutate(run.id)
  }
  const judge = (verdict: EvalJudgement) => {
    if (!run || pending) return
    resetErrors()
    result.mutate({ id: run.id, result: verdict })
  }

  // Space starts, Esc stops, S / F judges
  useHotkeys((e) => {
    if (phase === "idle" && e.code === "Space" && canStart) start()
    else if ((phase === "running" || phase === "loading") && (e.code === "Escape" || e.code === "Space")) stop()
    else if (phase === "judging" && e.key.toLowerCase() === "s") judge("success")
    else if (phase === "judging" && e.key.toLowerCase() === "f") judge("fail")
    else return false
    return true
  })

  return {
    runs,
    run,
    phase,
    elapsed: elapsedS * 1000,
    limitS: run?.limitS ?? limitS,
    recording: phase === "running" && !!run?.record,
    /** Why the active run ended early (shown while judging) */
    runError: run?.error ?? null,
    trials: trialsOf(runs.data ?? []),
    canStart,
    pending,
    error: startRun.error ?? stopRun.error ?? result.error,
    start,
    stop,
    judge,
  }
}

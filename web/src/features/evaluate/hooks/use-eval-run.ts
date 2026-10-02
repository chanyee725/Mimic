import { useEffect, useState } from "react"

import { useHotkeys } from "@/hooks/use-hotkeys"

import type { RunPhase, Trial, TrialResult } from "../lib"

/**
 * Policy run state. Tracks elapsed time once started and waits for a verdict when stopped or at the time limit.
 * Judged results accumulate in this session's trials.
 */
export function useEvalRun(instruction: string, initialLimitS: number) {
  const [limitS, setLimitS] = useState(initialLimitS)
  const [phase, setPhase] = useState<RunPhase>("idle")
  const [startedAt, setStartedAt] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [trials, setTrials] = useState<Trial[]>([])
  const canStart = !!instruction.trim()

  const start = () => {
    setStartedAt(performance.now())
    setElapsed(0)
    setPhase("running")
  }
  const stop = () => setPhase("judging")
  const judge = (result: TrialResult | null) => {
    if (result) setTrials((t) => [...t, { n: t.length + 1, instruction, seconds: elapsed / 1000, result }])
    setPhase("idle")
  }
  const clearTrials = () => setTrials([])

  // Tick elapsed time; stop at the time limit
  useEffect(() => {
    if (phase !== "running") return
    const id = setInterval(() => {
      const ms = performance.now() - startedAt
      setElapsed(ms)
      if (ms >= limitS * 1000) setPhase("judging")
    }, 100)
    return () => clearInterval(id)
  }, [phase, startedAt, limitS])

  // Space starts, Esc stops, S / F judges
  useHotkeys((e) => {
    if (phase === "idle" && e.code === "Space" && canStart) start()
    else if (phase === "running" && (e.code === "Escape" || e.code === "Space")) stop()
    else if (phase === "judging" && e.key.toLowerCase() === "s") judge("success")
    else if (phase === "judging" && e.key.toLowerCase() === "f") judge("fail")
    else return false
    return true
  })

  return { phase, elapsed, limitS, setLimitS, trials, canStart, start, stop, judge, clearTrials }
}

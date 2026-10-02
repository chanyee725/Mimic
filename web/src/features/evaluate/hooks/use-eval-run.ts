import { useEffect, useState } from "react"

import { useHotkeys } from "@/hooks/use-hotkeys"

import type { RunPhase, Trial, TrialResult } from "../lib"

/**
 * 정책 실행 상태. 시작하면 경과 시간을 재고, 제한 시간이 되거나 멈추면 판정을 기다린다.
 * 판정한 결과는 이번 세션의 trials 에 쌓인다.
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

  // 경과 시간, 제한 시간이 되면 멈춘다
  useEffect(() => {
    if (phase !== "running") return
    const id = setInterval(() => {
      const ms = performance.now() - startedAt
      setElapsed(ms)
      if (ms >= limitS * 1000) setPhase("judging")
    }, 100)
    return () => clearInterval(id)
  }, [phase, startedAt, limitS])

  // Space 시작 · Esc 멈춤 · S / F 판정
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

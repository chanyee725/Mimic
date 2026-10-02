import { useCallback, useEffect, useState } from "react"

import type { Outcome } from "@/dummy/tasks"

export type Phase = "idle" | "recording" | "review"

/**
 * 에피소드 상태 머신: idle → recording → review → (save | re-record | discard)
 * 실제 구현에서는 각 전이를 백엔드 EpisodeService 호출로 바꾼다.
 */
export function useEpisode({ durationS, startEpisode }: { durationS: number; startEpisode: number }) {
  const [phase, setPhase] = useState<Phase>("idle")
  const [episode, setEpisode] = useState(startEpisode)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [subtask, setSubtask] = useState(0)
  const [lastOutcome, setLastOutcome] = useState<Outcome | null>(null)

  useEffect(() => setEpisode(startEpisode), [startEpisode])

  useEffect(() => {
    if (phase !== "recording") return
    const started = performance.now() - elapsedMs
    const id = setInterval(() => {
      const ms = performance.now() - started
      if (ms >= durationS * 1000) {
        setElapsedMs(durationS * 1000)
        setPhase("review")
      } else {
        setElapsedMs(ms)
      }
    }, 100)
    return () => clearInterval(id)
    // elapsedMs 는 재개 시점 계산용으로만 읽는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, durationS])

  const start = useCallback(() => {
    setElapsedMs(0)
    setSubtask(0)
    setPhase("recording")
  }, [])

  const toggle = useCallback(() => {
    if (phase === "recording") setPhase("review")
    else start()
  }, [phase, start])

  const save = useCallback(
    (outcome: Outcome) => {
      if (phase === "idle") return
      setLastOutcome(outcome)
      setEpisode((e) => e + 1)
      setElapsedMs(0)
      setPhase("idle")
    },
    [phase],
  )

  const discard = useCallback(() => {
    setElapsedMs(0)
    setPhase("idle")
  }, [])

  return { phase, episode, elapsedMs, subtask, setSubtask, lastOutcome, toggle, start, save, discard }
}

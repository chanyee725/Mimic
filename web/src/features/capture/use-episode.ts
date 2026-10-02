import { useCallback, useEffect, useState } from "react"

import type { Outcome } from "@/dummy/tasks"

import { measureEpisode, recentEpisodes, type CapturedEpisode, type Review } from "./episode-review"

export type Phase = "idle" | "recording" | "review"

/**
 * 에피소드 상태 머신: idle → recording → review → (save | re-record | discard)
 * 실제 구현에서는 각 전이를 백엔드 EpisodeService 호출로 바꾼다.
 */
type Options = {
  durationS: number
  startEpisode: number
  subtasksTotal: number
  actionHz: number
  videoFps: number
}

export function useEpisode({ durationS, startEpisode, subtasksTotal, actionHz, videoFps }: Options) {
  const [phase, setPhase] = useState<Phase>("idle")
  const [episode, setEpisode] = useState(startEpisode)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [subtask, setSubtask] = useState(0)
  const [lastOutcome, setLastOutcome] = useState<Outcome | null>(null)
  // 저장된 에피소드 (최신이 앞). 저장 시 자동 검증 결과가 붙는다
  const [history, setHistory] = useState<CapturedEpisode[]>(() =>
    recentEpisodes(startEpisode, durationS, subtasksTotal, actionHz, videoFps),
  )

  // Task 가 바뀌면 번호와 최근 에피소드를 그 Task 기준으로 다시 채운다
  useEffect(() => {
    setEpisode(startEpisode)
    setHistory(recentEpisodes(startEpisode, durationS, subtasksTotal, actionHz, videoFps))
  }, [startEpisode, durationS, subtasksTotal, actionHz, videoFps])

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
      const record = measureEpisode({
        index: episode,
        lengthS: Math.max(0.1, elapsedMs / 1000),
        outcome,
        subtasksDone: outcome === "success" ? subtasksTotal : Math.min(subtasksTotal, subtask + 1),
        subtasksTotal,
        actionHz,
        videoFps,
      })
      setHistory((h) => [record, ...h])
      setLastOutcome(outcome)
      setEpisode((e) => e + 1)
      setElapsedMs(0)
      setPhase("idle")
    },
    [phase, episode, elapsedMs, subtask, subtasksTotal, actionHz, videoFps],
  )

  const discard = useCallback(() => {
    setElapsedMs(0)
    setPhase("idle")
  }, [])

  const review = useCallback((index: number, value: Review) => {
    setHistory((h) => h.map((e) => (e.index === index ? { ...e, review: value } : e)))
  }, [])

  return { phase, episode, elapsedMs, subtask, setSubtask, lastOutcome, history, review, toggle, start, save, discard }
}

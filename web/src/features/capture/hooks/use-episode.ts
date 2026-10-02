import { useCallback, useEffect, useRef, useState } from "react"

import type { Outcome } from "@/dummy/tasks"

import { measureEpisode, recentEpisodes, type CapturedEpisode, type Phase, type Review } from "../lib"

/**
 * Episode state machine: idle → recording → review → (save | re-record | discard)
 * In the real implementation each transition becomes a backend EpisodeService call.
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
  // Saved episodes (newest first). Validation results are attached on save
  const [history, setHistory] = useState<CapturedEpisode[]>(() =>
    recentEpisodes(startEpisode, durationS, subtasksTotal, actionHz, videoFps),
  )

  // When the task changes, reset the episode number and recent episodes for that task
  useEffect(() => {
    setEpisode(startEpisode)
    setHistory(recentEpisodes(startEpisode, durationS, subtasksTotal, actionHz, videoFps))
  }, [startEpisode, durationS, subtasksTotal, actionHz, videoFps])

  // Used to compute the resume point. Declared before the timer effect so it holds the latest value in the same commit
  const elapsedRef = useRef(elapsedMs)
  useEffect(() => {
    elapsedRef.current = elapsedMs
  })

  useEffect(() => {
    if (phase !== "recording") return
    const started = performance.now() - elapsedRef.current
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

export type EpisodeState = ReturnType<typeof useEpisode>

import { useEffect, useState } from "react"

import { useCaptureActions, useCaptureState } from "@/api/capture"
import { captureElapsedS, countdownLeftS, type CaptureState } from "@/domain/capture"
import type { Outcome, Task } from "@/domain/task"

/** Re-renders every 100 ms during the countdown and recording so the timers tick between server events */
function useLiveClock(state: CaptureState | undefined, maxS: number) {
  const ticking = state?.phase === "countdown" || state?.phase === "recording"
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!ticking) return
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [ticking])
  return {
    elapsedS: state ? Math.min(maxS, captureElapsedS(state, now)) : 0,
    countdownLeftS: state ? countdownLeftS(state, now) : null,
  }
}

/**
 * Episode controls over the station's state machine (idle → countdown → recording → review → save | re-record | discard).
 * Phase and elapsed time come from the server; every transition is a capture mutation.
 */
export function useCapture(task: Task | undefined, { startBlocked = false }: { startBlocked?: boolean } = {}) {
  const query = useCaptureState()
  const actions = useCaptureActions()
  const state = query.data
  const phase = state?.phase ?? "idle"
  const { elapsedS, countdownLeftS } = useLiveClock(state, task?.durationS ?? Infinity)

  // The station advances countdown → recording → review lazily, without events, so ask again from each boundary
  // until the phase changes (startedAt has whole-second precision, so the first ask can be early)
  const { refetch } = query
  const startedAt = state?.startedAt ? Date.parse(state.startedAt) : null
  const durationMs = (task?.durationS ?? 0) * 1000
  useEffect(() => {
    if (startedAt === null || !durationMs) return
    const at = phase === "countdown" ? startedAt : phase === "recording" ? startedAt + durationMs : null
    if (at === null) return
    let id: ReturnType<typeof setTimeout>
    const poll = () => {
      void refetch()
      id = setTimeout(poll, 500)
    }
    id = setTimeout(poll, Math.max(0, at - Date.now()) + 50)
    return () => clearTimeout(id)
  }, [phase, startedAt, durationMs, refetch])

  const all = [actions.start, actions.subtask, actions.stop, actions.save, actions.rerecord, actions.discard]
  const busy = !state || all.some((m) => m.isPending)
  // Only the latest action's error is shown
  const run = (fn: () => void) => {
    if (busy) return
    for (const m of all) m.reset()
    fn()
  }

  const toggle = () =>
    run(() => {
      if (phase === "recording") actions.stop.mutate()
      else if (phase === "review") actions.rerecord.mutate()
      else if (phase === "idle" && task && !startBlocked) actions.start.mutate({ taskId: task.id })
    })
  const save = (outcome: Outcome) =>
    run(() => {
      if (phase === "recording" || phase === "review") actions.save.mutate(outcome)
    })
  const rerecord = () =>
    run(() => {
      if (phase !== "idle") actions.rerecord.mutate()
    })
  const discard = () =>
    run(() => {
      if (phase !== "idle") actions.discard.mutate()
    })
  const setSubtask = (index: number) =>
    run(() => {
      if (phase === "recording") actions.subtask.mutate(index)
    })

  return {
    phase,
    elapsedS,
    /** Seconds until recording begins, during the countdown only */
    countdownLeftS,
    /** Episode number of the current / next recording */
    episode: state?.nextEpisode ?? 1,
    lastOutcome: actions.save.data?.outcome ?? null,
    busy,
    startBlocked,
    error: query.error ?? all.find((m) => m.error)?.error ?? null,
    toggle,
    save,
    rerecord,
    discard,
    setSubtask,
  }
}

export type CaptureControls = ReturnType<typeof useCapture>

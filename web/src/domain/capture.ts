// Capture state machine as reported by the station (docs/api/capture.md)

export type CapturePhase = "idle" | "countdown" | "recording" | "review"

export type CaptureState = {
  phase: CapturePhase
  /** When idle: the task of the last saved / discarded episode */
  taskId: string | null
  /** Recording being written, "<taskId>-<episode>" */
  episodeId: string | null
  /** ISO time recording began (after the countdown) */
  startedAt: string | null
  /** 0 during the countdown, frozen in review */
  elapsedS: number
  /** Current subtask marker (0-based index into task.subtasks) */
  subtaskIndex: number | null
  /** Episode number the current / next recording gets */
  nextEpisode: number
}

/** An episode is in progress (countdown, recording or awaiting review) */
export const isCapturing = (s: CaptureState) => s.phase !== "idle"

/** Task whose episode is in progress (the REC badge), null when idle */
export const capturingTaskId = (s: CaptureState | undefined) => (s && isCapturing(s) ? s.taskId : null)

/** Seconds left in the countdown (startedAt is when recording begins); null outside it */
export function countdownLeftS(s: CaptureState, now = Date.now()) {
  if (s.phase !== "countdown" || !s.startedAt) return null
  return Math.max(0, (Date.parse(s.startedAt) - now) / 1000)
}

/** Live elapsed seconds: ticks from startedAt while recording, the server value otherwise */
export function captureElapsedS(s: CaptureState, now = Date.now()) {
  if (s.phase !== "recording" || !s.startedAt) return s.elapsedS
  return Math.max(0, (now - Date.parse(s.startedAt)) / 1000)
}

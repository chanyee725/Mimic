import type { Outcome } from "@/dummy/tasks"

/** Phase of the episode state machine */
export type Phase = "idle" | "recording" | "review"

export const PHASE: Record<Phase, { label: string; className: string }> = {
  idle: { label: "READY", className: "bg-muted text-muted-foreground" },
  recording: { label: "REC", className: "bg-bad-muted text-bad" },
  review: { label: "REVIEW", className: "bg-warn-muted text-warn" },
}

export type Review = "pending" | "accepted" | "rejected"

/** A saved episode, carrying the automatic validation results computed on save */
export type CapturedEpisode = {
  index: number
  lengthS: number
  outcome: Outcome
  subtasksDone: number
  subtasksTotal: number
  actionSamples: number
  expectedActions: number
  videoFrames: number
  expectedFrames: number
  maxGapMs: number
  review: Review
}

type Check = { label: string; value: string; ok: boolean }

/** Automatic checks. Timestamp gaps up to 1.5x the frame period are tolerated */
function checksOf(e: CapturedEpisode, videoFps: number): Check[] {
  const tolerance = (1000 / videoFps) * 1.5
  return [
    {
      label: "Action samples",
      value: `${e.actionSamples.toLocaleString()} / ${e.expectedActions.toLocaleString()}`,
      ok: e.actionSamples >= e.expectedActions,
    },
    {
      label: "Video frames",
      value: `${e.videoFrames.toLocaleString()} / ${e.expectedFrames.toLocaleString()}`,
      ok: e.videoFrames >= e.expectedFrames,
    },
    { label: "Timestamp gap", value: `max ${Math.round(e.maxGapMs)} ms`, ok: e.maxGapMs <= tolerance },
    { label: "Subtasks", value: `${e.subtasksDone} / ${e.subtasksTotal}`, ok: e.subtasksDone === e.subtasksTotal },
  ]
}

/**
 * Dummy measurements mimicking a recording. The real app gets these from backend validation.
 * Mixes in occasional frame drops based on the episode index.
 */
export function measureEpisode(args: {
  index: number
  lengthS: number
  outcome: Outcome
  subtasksDone: number
  subtasksTotal: number
  actionHz: number
  videoFps: number
}): CapturedEpisode {
  const { index, lengthS, actionHz, videoFps } = args
  const expectedActions = Math.round(lengthS * actionHz)
  const expectedFrames = Math.round(lengthS * videoFps)
  const dropped = index % 5 === 3 ? Math.min(14, Math.max(1, Math.round(expectedFrames * 0.02))) : 0
  return {
    ...args,
    actionSamples: expectedActions,
    expectedActions,
    videoFrames: expectedFrames - dropped,
    expectedFrames,
    maxGapMs: (1000 / videoFps) * (dropped ? 2.1 : 1.02),
    review: "pending",
  }
}

/** Dummy recent episodes shown when the page opens */
export function recentEpisodes(nextIndex: number, durationS: number, subtasksTotal: number, actionHz: number, videoFps: number) {
  const outcomes: Outcome[] = ["success", "success", "fail", "success"]
  return outcomes
    .map((outcome, k) => {
      const index = nextIndex - outcomes.length + k
      const e = measureEpisode({
        index,
        lengthS: Math.max(5, durationS - 3 - ((k * 7) % 9)),
        outcome,
        subtasksDone: outcome === "success" ? subtasksTotal : Math.max(1, subtasksTotal - 2),
        subtasksTotal,
        actionHz,
        videoFps,
      })
      // Only older episodes that pass validation start out accepted
      const valid = checksOf(e, videoFps).every((c) => c.ok)
      return { ...e, review: k < 2 && valid ? ("accepted" as const) : ("pending" as const) }
    })
    .filter((e) => e.index > 0)
    .reverse()
}

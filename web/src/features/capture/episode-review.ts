import type { Outcome } from "@/dummy/tasks"

export type Review = "pending" | "accepted" | "rejected"

/** 저장된 에피소드 한 건. 저장 직후 자동 검증 결과를 함께 가진다 */
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

export type Check = { label: string; value: string; ok: boolean }

/** 자동 검증 항목. 타임스탬프 간격은 프레임 주기의 1.5배를 허용 범위로 본다 */
export function checksOf(e: CapturedEpisode, videoFps: number): Check[] {
  const tolerance = (1000 / videoFps) * 1.5
  return [
    { label: "Action samples", value: `${e.actionSamples.toLocaleString()} / ${e.expectedActions.toLocaleString()}`, ok: e.actionSamples >= e.expectedActions },
    { label: "Video frames", value: `${e.videoFrames.toLocaleString()} / ${e.expectedFrames.toLocaleString()}`, ok: e.videoFrames >= e.expectedFrames },
    { label: "Timestamp gap", value: `max ${Math.round(e.maxGapMs)} ms`, ok: e.maxGapMs <= tolerance },
    { label: "Subtasks", value: `${e.subtasksDone} / ${e.subtasksTotal}`, ok: e.subtasksDone === e.subtasksTotal },
  ]
}

/**
 * 녹화 결과를 흉내 낸 더미 측정값. 실제로는 백엔드 검증 결과를 받는다.
 * 에피소드 번호 기준으로 가끔 프레임 드랍을 섞는다.
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

/** 화면 진입 시 보여줄 최근 에피소드 더미 */
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
      // 오래된 것 중 검증을 통과한 에피소드만 승인된 상태로 둔다
      const valid = checksOf(e, videoFps).every((c) => c.ok)
      return { ...e, review: k < 2 && valid ? ("accepted" as const) : ("pending" as const) }
    })
    .filter((e) => e.index > 0)
    .reverse()
}

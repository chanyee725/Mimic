import type { Outcome } from "@/dummy/tasks"

export type SessionStatus = "recording" | "review" | "converted"
export type Review = "accepted" | "rejected" | "pending"

export type Session = {
  id: string
  taskId: string
  operator: string // 가명 ID
  episodes: number
  accepted: number
  successPct: number
  failPct: number
  status: SessionStatus
  date: string
}

export const SESSIONS: Session[] = [
  { id: "ses_0013", taskId: "stack-two-blocks", operator: "OP-02", episodes: 12, accepted: 10, successPct: 75, failPct: 8, status: "recording", date: "2026-10-02" },
  { id: "ses_0012", taskId: "pick-red-cube", operator: "OP-03", episodes: 14, accepted: 12, successPct: 79, failPct: 14, status: "recording", date: "2026-10-02" },
  { id: "ses_0011", taskId: "stack-two-blocks", operator: "OP-01", episodes: 50, accepted: 46, successPct: 84, failPct: 8, status: "review", date: "2026-10-01" },
  { id: "ses_0010", taskId: "open-drawer", operator: "OP-03", episodes: 40, accepted: 38, successPct: 90, failPct: 5, status: "converted", date: "2026-09-30" },
  { id: "ses_0009", taskId: "pour-into-cup", operator: "OP-02", episodes: 24, accepted: 22, successPct: 71, failPct: 17, status: "review", date: "2026-09-29" },
  { id: "ses_0008", taskId: "stack-two-blocks", operator: "OP-01", episodes: 20, accepted: 15, successPct: 75, failPct: 25, status: "converted", date: "2026-09-27" },
]

export type Episode = {
  index: number
  lengthS: number
  actionSamples: number
  videoFrames: number
  dropPct: number
  outcome: Outcome
  subtasksDone: number
  review: Review
}

/** 세션별 에피소드 더미 생성 (action 60Hz, video 30fps 기준) */
export function episodesOf(sessionId: string, count = 8): Episode[] {
  const seed = Number(sessionId.replace(/\D/g, "")) || 1
  const outcomes: Outcome[] = ["success", "success", "partial", "success", "fail", "success", "success", "success"]
  return Array.from({ length: count }, (_, i) => {
    const lengthS = 18 + ((i * 7 + seed) % 11)
    const dropped = i === 3
    const outcome = outcomes[(i + seed) % outcomes.length]
    return {
      index: i,
      lengthS,
      actionSamples: lengthS * 60,
      videoFrames: lengthS * 30 - (dropped ? 14 : 0),
      dropPct: dropped ? 2.6 : 0.1 * (i % 3),
      outcome,
      subtasksDone: outcome === "success" ? 4 : outcome === "partial" ? 3 : 2,
      review: dropped ? "rejected" : i > 5 ? "pending" : "accepted",
    }
  })
}

export type ValidationCheck = { label: string; value: string; ok: boolean }

export const EPISODE_CHECKS: ValidationCheck[] = [
  { label: "Action samples = length × 60", value: "1,260", ok: true },
  { label: "Video frames = length × 30", value: "616 / 630", ok: false },
  { label: "Timestamp gap (tolerance)", value: "max 71 ms", ok: false },
  { label: "Joint range within limits", value: "OK", ok: true },
  { label: "Subtask segments complete", value: "4 / 4", ok: true },
]

/** 리플레이 타임라인의 서브태스크 구간 비율(%) */
export const REPLAY_SEGMENTS = [
  { name: "reach", pct: 22 },
  { name: "grasp", pct: 18 },
  { name: "lift", pct: 25 },
  { name: "place", pct: 35 },
]

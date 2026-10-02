import type { Tone } from "@/components/app/status-dot"
import type { RecordingReview } from "@/dummy/recordings"
import type { Outcome } from "@/dummy/tasks"

// ── 검수 상태 / 결과 표시 ────────────────────────────────

export const REVIEW_TONE: Record<RecordingReview, Tone> = { pending: "muted", accepted: "ok", rejected: "bad" }

export const REVIEW_CLASS: Record<RecordingReview, string> = {
  pending: "text-muted-foreground",
  accepted: "text-ok",
  rejected: "text-bad",
}

export const OUTCOME_TONE: Record<Outcome, Tone> = { success: "ok", fail: "bad", partial: "warn" }

// ── 에피소드 목록 ──────────────────────────────────────

export const PAGE_SIZE = 10

export type ReviewFilter = "all" | RecordingReview

export const FILTERS: { value: ReviewFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
]

/** 가장 최근 에피소드부터 */
export const latestFirst = <T extends { episode?: number }>(xs: T[]) => [...xs].sort((a, b) => (b.episode ?? 0) - (a.episode ?? 0))

/** `stack-two-blocks/ep_0047.mcap` → `ep_0047` */
export const shortName = (file: string) =>
  file
    .split("/")
    .pop()!
    .replace(/\.mcap$/, "")

// ── 플레이어 ─────────────────────────────────────────

export const SPEEDS = [0.5, 1, 2] as const

export type Speed = (typeof SPEEDS)[number]

/** recording id 로 고정되는 시드 (같은 파일은 항상 같은 궤적) */
export function seedOf(id: string) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 1000
  return h / 1000
}

/** `/cam_top/image` → `Top`, 그 외는 토픽 이름 그대로 */
export function cameraLabel(topic: string) {
  const cam = topic.match(/^\/cam_([^/]+)/)?.[1]
  return cam ? cam.charAt(0).toUpperCase() + cam.slice(1) : topic
}

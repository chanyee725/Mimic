import type { Tone } from "@/components/common/status-dot"
import type { RecordingReview } from "@/domain/recording"
import type { Outcome } from "@/domain/task"

// ── Review status / outcome display ─────────────────────

export const REVIEW_TONE: Record<RecordingReview, Tone> = { pending: "muted", accepted: "ok", rejected: "bad" }

export const REVIEW_CLASS: Record<RecordingReview, string> = {
  pending: "text-muted-foreground",
  accepted: "text-ok",
  rejected: "text-bad",
}

export const OUTCOME_TONE: Record<Outcome, Tone> = { success: "ok", fail: "bad", partial: "warn" }

// ── Episode list ───────────────────────────────────────

export const PAGE_SIZE = 10

export type ReviewFilter = "all" | RecordingReview

export const FILTERS: { value: ReviewFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
]

/** `stack-two-blocks/ep_0047.mcap` → `ep_0047` */
export const shortName = (file: string) =>
  file
    .split("/")
    .pop()!
    .replace(/\.mcap$/, "")

// ── Player ───────────────────────────────────────────

export const SPEEDS = [0.5, 1, 2] as const

export type Speed = (typeof SPEEDS)[number]

/** Max samples per series the samples endpoint returns */
const MAX_SAMPLES = 100_000

/** Plot sample rate: the recorded action rate, lowered so a long file stays under the endpoint's sample limit */
export function samplesHz(actionHz: number, durationS: number) {
  return Math.max(1, Math.min(actionHz, Math.floor(MAX_SAMPLES / Math.max(durationS, 1)) - 1))
}

/** `/cam_top/image` → `Top`; any other topic name is returned as is */
export function cameraLabel(topic: string) {
  const cam = topic.match(/^\/cam_([^/]+)/)?.[1]
  return cam ? cam.charAt(0).toUpperCase() + cam.slice(1) : topic
}

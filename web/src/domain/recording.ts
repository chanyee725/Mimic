import type { Outcome } from "@/domain/task"

export type TopicKind = "action" | "state" | "video" | "label" | "glove" | "other"

export type McapTopic = {
  name: string
  schema: string // protobuf message type
  kind: TopicKind
  rateHz: number | null // null = event-based
  messages: number
}

export type RecordingReview = "pending" | "accepted" | "rejected"

export type RecordingCheck = { label: string; value: string; ok: boolean }

export type Recording = {
  id: string
  file: string
  source: "capture" | "external"
  taskId?: string // capture files only
  rigId?: string
  episode?: number
  recordedAt: string
  durationS: number
  sizeMB: number
  outcome?: Outcome
  review: RecordingReview
  topics: McapTopic[]
  subtasks: { name: string; startS: number; endS: number }[]
  /** Times (s) where video frames were dropped */
  drops: number[]
  checks: RecordingCheck[]
}

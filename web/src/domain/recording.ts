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

export type RecordingSource = "capture" | "external"

export type RecordingCheck = { label: string; value: string; ok: boolean }

export type SubtaskSpan = { name: string; startS: number; endS: number }

export type Recording = {
  id: string
  /** Path relative to the raw folder, e.g. "stack-two-blocks/ep_0042.mcap" */
  file: string
  source: RecordingSource
  taskId: string | null // capture files only
  rigId: string | null
  simEnv: string | null // Isaac Sim environment, for an episode recorded on a sim rig
  episode: number | null
  /** ISO 8601 */
  recordedAt: string
  durationS: number
  sizeMB: number
  outcome: Outcome | null
  review: RecordingReview
  topics: McapTopic[]
  subtasks: SubtaskSpan[]
  /** Times (s) where video frames were dropped */
  drops: number[]
  checks: RecordingCheck[]
}

/** Topics the samples endpoint can resample */
export type SampleTopic = "action" | "state"

/** Resampled joint series for plots: series[topic][joint][sample], one sample every 1/hz s */
export type RecordingSamples = {
  joints: string[]
  t: number[]
  series: Partial<Record<SampleTopic, number[][]>>
}

/** Camera keys of a recording, from its "/cam_<key>/image" topics */
export const recordingCameras = (r: Recording) =>
  r.topics.flatMap((t) => {
    const m = /^\/cam_(.+)\/image$/.exec(t.name)
    return m ? [m[1]] : []
  })

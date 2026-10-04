export type DatasetKind = "lerobot" | "mcap"

export type DatasetStatus = "ready" | "converting" | "failed"

/** One LeRobot feature or one MCAP topic */
export type DatasetFeature = {
  key: string
  dtype: string
  shape: string
  note: string | null
}

/** One item of the paged GET /datasets/{repoId}/episodes */
export type DatasetEpisode = {
  index: number
  source: string // source MCAP
  lengthS: number
  frames: number
}

export type Dataset = {
  kind: DatasetKind
  repoId: string
  /** "mixed" for a merged dataset whose sources come from different tasks */
  taskId: string
  rigId: string
  format: string
  fps: number
  status: DatasetStatus
  progress: number | null // 0–100 while converting
  error: string | null // when failed
  /** ISO 8601 */
  createdAt: string
  sizeGB: number
  hub: { pushed: boolean; private: boolean }
  features: DatasetFeature[]
  episodeCount: number
  /** repoIds this dataset was merged from (merged datasets only) */
  sources?: string[] | null
}

/** What converting a task's accepted recordings (minus excluded ones) would produce */
export type ConvertPreview = {
  fps: number
  actionHz: number
  features: DatasetFeature[]
  episodes: number
  frames: number
  lengthS: number
  mcapMB: number
  estOutputMB: number
  /** ISO range of the source recordings; null when there are no episodes */
  recordedFrom: string | null
  recordedTo: string | null
}

/** GET /datasets/merge/preview: what merging the sources (in order) would produce */
export type MergePreview = {
  sources: { repoId: string; episodes: number; frames: number; fps: number; rigId: string; taskId: string }[]
  /** null when the sources disagree */
  fps: number | null
  episodes: number
  frames: number
  sizeGB: number
  features: DatasetFeature[]
  /** Why the sources can't be merged; empty = mergeable */
  problems: string[]
}

/** taskId of a merged dataset whose sources span several tasks */
export const MIXED_TASK = "mixed"

export const isConverting = (d: Dataset) => d.status === "converting"

/** Datasets that can be merged: finished LeRobot conversions */
export const isMergeable = (d: Dataset) => d.kind === "lerobot" && d.status === "ready"

/** Has camera video (feature dtype "video"), so a thumbnail can be cut from it */
export const hasVideo = (d: Dataset) => d.features.some((f) => f.dtype === "video")

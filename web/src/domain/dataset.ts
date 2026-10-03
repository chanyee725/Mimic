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

export const isConverting = (d: Dataset) => d.status === "converting"

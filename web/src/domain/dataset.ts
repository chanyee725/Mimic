export type DatasetKind = "lerobot" | "mcap"

export type DatasetStatus = "ready" | "converting" | "failed"

/** One LeRobot feature or one MCAP topic */
export type DatasetFeature = {
  key: string
  dtype: string
  shape: string
  note?: string
}

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
  progress?: number // 0–100 while converting
  createdAt: string
  sizeGB: number
  hub: { pushed: boolean; private: boolean }
  features: DatasetFeature[]
  episodes: DatasetEpisode[]
}

// Convert 로 만든 LeRobot 데이터셋 더미.
// 실제로는 변환 작업이 끝나면 meta/info.json 을 읽어 채운다.

export type DatasetStatus = "ready" | "converting" | "failed"

export type DatasetFeature = {
  key: string
  dtype: string
  shape: string
  note?: string
}

export type DatasetEpisode = {
  index: number
  source: string // 원본 MCAP
  lengthS: number
  frames: number
}

export type Dataset = {
  repoId: string
  taskId: string
  rigId: string
  format: string
  fps: number
  status: DatasetStatus
  progress?: number // converting 일 때 0–100
  createdAt: string
  sizeGB: number
  hub: { pushed: boolean; private: boolean }
  features: DatasetFeature[]
  episodes: DatasetEpisode[]
}

const SO101_FEATURES = (cameras: string[]): DatasetFeature[] => [
  { key: "action", dtype: "float32", shape: "[6]", note: "60 Hz → 30 Hz" },
  { key: "observation.state", dtype: "float32", shape: "[6]" },
  ...cameras.map((c) => ({ key: `observation.images.${c}`, dtype: "video", shape: "[480, 640, 3]", note: "AV1" })),
  { key: "subtask_index", dtype: "int64", shape: "[1]" },
  { key: "timestamp", dtype: "float32", shape: "[1]" },
  { key: "frame_index", dtype: "int64", shape: "[1]" },
  { key: "episode_index", dtype: "int64", shape: "[1]" },
  { key: "task_index", dtype: "int64", shape: "[1]" },
]

const episodes = (taskId: string, from: number, lengths: number[]): DatasetEpisode[] =>
  lengths.map((lengthS, i) => ({
    index: i,
    source: `${taskId}/ep_${String(from + i).padStart(4, "0")}.mcap`,
    lengthS,
    frames: Math.round(lengthS * 30),
  }))

export const DATASETS: Dataset[] = [
  {
    repoId: "local/stack_two_blocks",
    taskId: "stack-two-blocks",
    rigId: "so101-kit",
    format: "LeRobot v3.0",
    fps: 30,
    status: "ready",
    createdAt: "2026-10-01 18:20",
    sizeGB: 1.4,
    hub: { pushed: true, private: true },
    features: SO101_FEATURES(["top", "wrist"]),
    episodes: episodes("stack-two-blocks", 30, [24.0, 27.5, 22.1, 21.0, 26.5, 23.5, 25.0, 20.5, 28.0, 22.5]),
  },
  {
    repoId: "local/open_drawer",
    taskId: "open-drawer",
    rigId: "so101-kit",
    format: "LeRobot v3.0",
    fps: 30,
    status: "ready",
    createdAt: "2026-09-30 21:05",
    sizeGB: 2.3,
    hub: { pushed: true, private: true },
    features: SO101_FEATURES(["top", "wrist"]),
    episodes: episodes("open-drawer", 1, [18.5, 20.0, 19.2, 21.8, 17.9, 22.4, 20.6, 19.0]),
  },
  {
    repoId: "local/pick_red_cube",
    taskId: "pick-red-cube",
    rigId: "so101-kit",
    format: "LeRobot v3.0",
    fps: 30,
    status: "converting",
    progress: 37,
    createdAt: "2026-10-02 11:40",
    sizeGB: 0.3,
    hub: { pushed: false, private: true },
    features: SO101_FEATURES(["top", "wrist"]),
    episodes: episodes("pick-red-cube", 1, [18.2, 19.0, 17.5]),
  },
  {
    repoId: "local/pour_into_cup",
    taskId: "pour-into-cup",
    rigId: "so101-kit",
    format: "LeRobot v3.0",
    fps: 30,
    status: "failed",
    createdAt: "2026-09-29 16:12",
    sizeGB: 0,
    hub: { pushed: false, private: true },
    features: SO101_FEATURES(["top", "wrist"]),
    episodes: [],
  },
]

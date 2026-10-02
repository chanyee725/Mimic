// 데이터셋 더미. LeRobot 은 Convert 로 만든 것, MCAP 은 변환 없이 원본 에피소드를 묶어 올린 것.
// 실제로는 LeRobot 은 meta/info.json, MCAP 은 각 파일의 요약(summary) 섹션을 읽어 채운다.
// 썸네일은 첫 에피소드의 첫 카메라 프레임을 쓴다 (더미에서는 그림으로 대신한다).

export type DatasetKind = "lerobot" | "mcap"
export type DatasetStatus = "ready" | "converting" | "failed"

/** LeRobot 은 feature, MCAP 은 topic 한 줄 */
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
  kind: DatasetKind
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

const MCAP_TOPICS: DatasetFeature[] = [
  { key: "/so101_leader/action", dtype: "vla.robot.JointCommand", shape: "60 Hz" },
  { key: "/so101_follower/state", dtype: "vla.robot.JointState", shape: "60 Hz" },
  { key: "/cam_top/image", dtype: "foxglove.CompressedVideo", shape: "30 fps" },
  { key: "/cam_wrist/image", dtype: "foxglove.CompressedVideo", shape: "30 fps" },
  { key: "/labels/subtask", dtype: "vla.session.SubtaskEvent", shape: "event" },
  { key: "/labels/outcome", dtype: "vla.session.OutcomeEvent", shape: "event" },
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
    kind: "lerobot",
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
    kind: "lerobot",
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
    kind: "lerobot",
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
    kind: "lerobot",
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
  {
    kind: "mcap",
    repoId: "raw/stack_two_blocks",
    taskId: "stack-two-blocks",
    rigId: "so101-kit",
    format: "MCAP",
    fps: 30,
    status: "ready",
    createdAt: "2026-10-01 18:02",
    sizeGB: 0.9,
    hub: { pushed: true, private: true },
    features: MCAP_TOPICS,
    episodes: episodes("stack-two-blocks", 30, [24.0, 27.5, 22.1, 21.0, 26.5, 23.5, 25.0, 20.5, 28.0, 22.5, 21.5, 29.0]),
  },
  {
    kind: "mcap",
    repoId: "raw/sort_by_color",
    taskId: "sort-by-color",
    rigId: "so101-kit",
    format: "MCAP",
    fps: 30,
    status: "ready",
    createdAt: "2026-09-27 10:44",
    sizeGB: 0.4,
    hub: { pushed: false, private: true },
    features: MCAP_TOPICS,
    episodes: episodes("sort-by-color", 1, [31.0, 34.5, 29.8, 33.2, 30.6]),
  },
  {
    kind: "mcap",
    repoId: "raw/wipe_table",
    taskId: "wipe-table",
    rigId: "so101-kit",
    format: "MCAP",
    fps: 30,
    status: "ready",
    createdAt: "2026-09-25 14:20",
    sizeGB: 0.2,
    hub: { pushed: false, private: true },
    features: MCAP_TOPICS,
    episodes: episodes("wipe-table", 1, [15.4, 17.0, 16.2]),
  },
]

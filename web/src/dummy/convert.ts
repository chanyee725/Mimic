import type { Alignment } from "@/dummy/tasks"

export const ALIGNMENT_MODES: { id: Alignment; title: string; spec: string; description: string; fps: number }[] = [
  { id: "chunk", title: "fps 30 · action chunk", spec: "action: [2, 6]", description: "영상 1프레임마다 60Hz action 2개를 묶음. 60Hz 정보 손실 없음.", fps: 30 },
  { id: "duplicate", title: "fps 60 · duplicate video", spec: "video 60 fps (dup)", description: "데이터셋 60fps, 영상 프레임 복제. 기본 로더 호환이 가장 쉬움.", fps: 60 },
  { id: "downsample", title: "fps 30 · downsample", spec: "action: [6] @30", description: "action을 30Hz로 줄임. 가장 단순하지만 정보 손실.", fps: 30 },
]

export type RawStream = { raw: string; rate: string; feature: string; kind: "action" | "state" | "video" | "label" | "glove"; included: boolean }

export const RAW_STREAMS: RawStream[] = [
  { raw: "/so101_leader/action", rate: "60 Hz", feature: "action", kind: "action", included: true },
  { raw: "/so101_follower/state", rate: "60 Hz", feature: "observation.state", kind: "state", included: true },
  { raw: "/cam_front/image", rate: "30 fps", feature: "observation.images.front", kind: "video", included: true },
  { raw: "/cam_wrist/image", rate: "30 fps", feature: "observation.images.wrist", kind: "video", included: true },
  { raw: "/labels/subtask", rate: "event", feature: "subtask_index", kind: "label", included: true },
  { raw: "/glove_r/imu", rate: "200 Hz", feature: "observation.hand.imu", kind: "glove", included: false },
  { raw: "/glove_r/tactile", rate: "100 Hz", feature: "observation.hand.tactile", kind: "glove", included: false },
]

export const RETARGET_OPTIONS = [
  "None",
  "Glove → SO-101 gripper (pinch distance)",
  "Glove → dexterous hand (joint map)",
]

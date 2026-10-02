import type { Alignment } from "@/dummy/tasks"

export const ALIGNMENT_MODES: { id: Alignment; title: string; spec: string; description: string; fps: number }[] = [
  { id: "chunk", title: "fps 30 · action chunk", spec: "action: [2, 6]", description: "영상 1프레임마다 60Hz action 2개를 묶음. 60Hz 정보 손실 없음.", fps: 30 },
  { id: "duplicate", title: "fps 60 · duplicate video", spec: "video 60 fps (dup)", description: "데이터셋 60fps, 영상 프레임 복제. 기본 로더 호환이 가장 쉬움.", fps: 60 },
  { id: "downsample", title: "fps 30 · downsample", spec: "action: [6] @30", description: "action을 30Hz로 줄임. 가장 단순하지만 정보 손실.", fps: 30 },
]

export const RETARGET_OPTIONS = [
  "None",
  "Glove → SO-101 gripper (pinch distance)",
  "Glove → dexterous hand (joint map)",
]

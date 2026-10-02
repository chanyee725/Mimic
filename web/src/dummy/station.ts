export const STATION = { id: "Station 01", robot: "SO-101", date: "2026-10-02" }

/** 지금까지 취득된 데이터 누적치 (action 60Hz, video 30fps 기준) */
export const DATA_TOTALS = [
  { key: "episodes", label: "Episodes", value: "1,212" },
  { key: "frames", label: "Frames", value: "799,200" },
  { key: "hours", label: "Hours", value: "7.4 h" },
  { key: "storage", label: "Storage", value: "84.3 GB" },
  { key: "success", label: "Success rate", value: "84%" },
] as const

/** 지금 Capture 중인 Task */
export const CURRENT_TASK_ID = "stack-two-blocks"

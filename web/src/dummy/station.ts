import type { DataTotal, Station } from "@/domain/station"

export const STATION: Station = { id: "Station 01", robot: "SO-101", date: "2026-10-02" }

/** Totals collected so far (action 60 Hz, video 30 fps) */
export const DATA_TOTALS: DataTotal[] = [
  { key: "episodes", label: "Episodes", value: "1,212" },
  { key: "frames", label: "Frames", value: "799,200" },
  { key: "hours", label: "Hours", value: "7.4 h" },
  { key: "storage", label: "Storage", value: "84.3 GB" },
  { key: "success", label: "Success rate", value: "84%" },
]

/** Task currently being captured */
export const CURRENT_TASK_ID = "stack-two-blocks"

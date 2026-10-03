import type { Tone } from "@/components/common/status-dot"
import type { DatasetKind, DatasetStatus } from "@/domain/dataset"

export const STATUS: Record<DatasetStatus, { tone: Tone; label: string }> = {
  ready: { tone: "ok", label: "Ready" },
  converting: { tone: "info", label: "Converting" },
  failed: { tone: "bad", label: "Failed" },
}

export type Filter = "all" | DatasetKind
export const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "lerobot", label: "LeRobot" },
  { id: "mcap", label: "MCAP" },
]
export const KIND_LABEL: Record<DatasetKind, string> = { lerobot: "LeRobot", mcap: "MCAP" }
// List dot colour marks the format (status is shown in the detail header and the subtitle)
export const KIND_DOT: Record<DatasetKind, string> = { lerobot: "bg-yellow-400", mcap: "bg-zinc-400" }

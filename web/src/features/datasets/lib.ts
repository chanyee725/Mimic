import type { Tone } from "@/components/common/status-dot"
import type { Dataset, DatasetKind, DatasetStatus } from "@/domain/dataset"

export const STATUS: Record<DatasetStatus, { tone: Tone; label: string }> = {
  ready: { tone: "ok", label: "Ready" },
  converting: { tone: "info", label: "Converting" },
  failed: { tone: "bad", label: "Failed" },
}

/** Status shown for a dataset; a running or failed Pull reads as a download */
export function datasetStatus(d: Pick<Dataset, "status" | "hub">): { tone: Tone; label: string } {
  if (d.hub.pulled && d.status === "converting") return { tone: "info", label: "Downloading" }
  if (d.hub.pulled && d.status === "failed") return { tone: "bad", label: "Download failed" }
  return STATUS[d.status]
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

import { listModels } from "@/api/models"
import type { Model } from "@/domain/model"

export type Filter = "all" | "local" | "hub"

export const FILTERS: { id: Filter; label: string; fits: (m: Model) => boolean }[] = [
  { id: "all", label: "All", fits: () => true },
  { id: "local", label: "Local", fits: (m) => !!m.localPath },
  { id: "hub", label: "HF Hub", fits: (m) => !!m.hubRepo },
]

// Most recently saved first
export const sortedModels = () => [...listModels()].sort((a, b) => b.savedAt.localeCompare(a.savedAt))

/** File size label; "< 1 MB" below 1 MB */
export const formatFileSize = (mb: number) => (mb >= 1 ? `${mb.toLocaleString()} MB` : "< 1 MB")

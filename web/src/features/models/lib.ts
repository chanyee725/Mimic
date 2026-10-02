import { MODELS, type Model } from "@/dummy/models"

export type Filter = "all" | "local" | "hub"

export const FILTERS: { id: Filter; label: string; fits: (m: Model) => boolean }[] = [
  { id: "all", label: "All", fits: () => true },
  { id: "local", label: "Local", fits: (m) => !!m.localPath },
  { id: "hub", label: "HF Hub", fits: (m) => !!m.hubRepo },
]

// 최근 저장한 것부터
export const SORTED = [...MODELS].sort((a, b) => b.savedAt.localeCompare(a.savedAt))

/** 파일 크기 표시. 1 MB 보다 작으면 "< 1 MB" */
export const formatFileSize = (mb: number) => (mb >= 1 ? `${mb.toLocaleString()} MB` : "< 1 MB")

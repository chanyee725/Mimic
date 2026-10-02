import { useSyncExternalStore } from "react"

import { RECORDINGS, type Recording, type RecordingReview } from "@/dummy/recordings"

// Review 와 Convert 가 함께 쓰는 녹화 목록. 백엔드 연결 전까지 메모리에만 둔다.
let recordings: Recording[] = RECORDINGS
const listeners = new Set<() => void>()

function emit(next: Recording[]) {
  recordings = next
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setReview(id: string, review: RecordingReview) {
  emit(recordings.map((r) => (r.id === id ? { ...r, review } : r)))
}

export function deleteRecording(id: string) {
  emit(recordings.filter((r) => r.id !== id))
}

export function useRecordings() {
  return useSyncExternalStore(subscribe, () => recordings)
}

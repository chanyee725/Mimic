import { useState } from "react"

/** Per-section edit state. Only the draft changes until saved; the save bar shows while dirty */
export function useDraft<T>(initial: T) {
  const [saved, setSaved] = useState(initial)
  const [draft, setDraft] = useState(initial)
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const set = <K extends keyof T>(key: K, value: T[K]) => setDraft((d) => ({ ...d, [key]: value }))
  return { draft, set, setDraft, dirty, save: () => setSaved(draft), reset: () => setDraft(saved) }
}

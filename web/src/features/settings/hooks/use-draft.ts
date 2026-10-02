import { useState } from "react"

/** 섹션 단위 편집 상태. 저장 전까지는 draft 만 바뀌고, dirty 면 저장 바가 보인다 */
export function useDraft<T>(initial: T) {
  const [saved, setSaved] = useState(initial)
  const [draft, setDraft] = useState(initial)
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const set = <K extends keyof T>(key: K, value: T[K]) => setDraft((d) => ({ ...d, [key]: value }))
  return { draft, set, setDraft, dirty, save: () => setSaved(draft), reset: () => setDraft(saved) }
}

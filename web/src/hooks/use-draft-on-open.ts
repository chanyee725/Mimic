import { useState } from "react"

/**
 * 모달 편집용 초안. 모달이 열릴 때마다 value 로 다시 시작하고, 닫히기 전까지는 draft 만 바뀐다.
 * (React 문서의 "prop 이 바뀔 때 state 조정" 패턴을 한 곳에 모은 것)
 */
export function useDraftOnOpen<T>(open: boolean, value: T) {
  const [draft, setDraft] = useState(value)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setDraft(value)
  }
  return [draft, setDraft] as const
}

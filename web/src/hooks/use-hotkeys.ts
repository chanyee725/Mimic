import { useEffect, useRef } from "react"

/** 입력 중인 칸에서는 단축키를 받지 않는다 */
export const isTypingTarget = (el: EventTarget | null) =>
  el instanceof HTMLInputElement ||
  el instanceof HTMLTextAreaElement ||
  el instanceof HTMLSelectElement ||
  (el instanceof HTMLElement && el.isContentEditable)

/**
 * window keydown 단축키. handler 는 ref 로 들고 있어서 렌더마다 다시 등록하지 않는다.
 * handler 가 true 를 돌려주면 처리한 것으로 보고 기본 동작을 막는다.
 */
export function useHotkeys(handler: (e: KeyboardEvent) => boolean | void, { ignoreRepeat = true } = {}) {
  const ref = useRef(handler)
  useEffect(() => {
    ref.current = handler
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || (ignoreRepeat && e.repeat)) return
      if (ref.current(e)) e.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [ignoreRepeat])
}

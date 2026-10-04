import { useEffect, useRef } from "react"

/** Ignore shortcuts while typing in a field */
export const isTypingTarget = (el: EventTarget | null) =>
  el instanceof HTMLInputElement ||
  el instanceof HTMLTextAreaElement ||
  el instanceof HTMLSelectElement ||
  (el instanceof HTMLElement && el.isContentEditable)

/**
 * Window keydown shortcuts. The handler is kept in a ref so the listener isn't re-registered every render.
 * Return true from the handler to mark the key as handled and prevent the default action.
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

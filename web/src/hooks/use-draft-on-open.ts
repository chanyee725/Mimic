import { useState } from "react"

/**
 * Draft state for dialogs. Restarts from value each time the dialog opens; only the draft changes until it closes.
 * (The "adjusting state when a prop changes" pattern from the React docs, in one place)
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

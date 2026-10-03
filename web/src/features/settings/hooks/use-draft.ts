import { useState } from "react"

import { ApiError } from "@/api/client"
import { usePatchSettings, useSettings } from "@/api/settings"
import type { Settings, SettingsPatch, SettingsSection } from "@/domain/settings"

import { editable, errorText, sameEdits } from "../lib"

const CONFLICT = "다른 곳에서 먼저 저장되어 최신 설정을 다시 불러왔습니다. 변경 내용을 다시 입력한 뒤 저장하세요."

/**
 * Edit state for one settings section. The draft follows the server while it has no edits; Save sends the document
 * version the draft is based on, and a 409 reloads the section from `details.current`.
 * `server` holds the live section (read-only fields such as connection state and secrets are shown from it).
 */
export function useSettingsDraft<S extends SettingsSection>(section: S) {
  const query = useSettings()
  const patch = usePatchSettings()
  const doc = query.data
  const [draft, setDraft] = useState<Settings[S] | undefined>(doc?.[section])
  const [baseVersion, setBaseVersion] = useState(doc?.version)
  const [prevDoc, setPrevDoc] = useState(doc)
  const [notice, setNotice] = useState<string | null>(null)

  if (doc !== prevDoc) {
    setPrevDoc(doc)
    if (doc) {
      const prevSection = prevDoc?.[section]
      const untouched = draft === undefined || sameEdits(draft, prevSection)
      if (untouched) {
        setDraft(doc[section])
        setBaseVersion(doc.version)
      } else if (sameEdits(prevSection, doc[section])) {
        // Another section changed: this draft is still based on current data
        setBaseVersion(doc.version)
      }
      // else: someone changed this section while it is being edited; Save will get a 409
    }
  }

  const dirty = draft !== undefined && doc !== undefined && !sameEdits(draft, doc[section])

  const set = <K extends keyof Settings[S]>(key: K, value: Settings[S][K]) =>
    setDraft((d) => (d === undefined ? d : { ...d, [key]: value }))

  function save() {
    if (draft === undefined || baseVersion === undefined) return
    setNotice(null)
    patch.mutate(
      { section, body: { ...editable(draft), version: baseVersion } as SettingsPatch },
      {
        onSuccess: (settings) => {
          setDraft(settings[section])
          setBaseVersion(settings.version)
        },
        onError: (err) => {
          if (!(err instanceof ApiError && err.status === 409)) return
          const current = err.details.current as Settings | undefined
          if (current) {
            setDraft(current[section])
            setBaseVersion(current.version)
          }
          patch.reset()
          setNotice(CONFLICT)
          void query.refetch()
        },
      },
    )
  }

  function reset() {
    if (doc) setDraft(doc[section])
    if (doc) setBaseVersion(doc.version)
    patch.reset()
    setNotice(null)
  }

  return {
    query,
    server: doc?.[section],
    draft,
    set,
    setDraft,
    dirty,
    save,
    reset,
    saveBar: { dirty, pending: patch.isPending, error: notice ?? errorText(patch.error), onSave: save, onReset: reset },
  }
}

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useDeleteSecret, useSetSecret } from "@/api/settings"
import type { Secret, SecretName } from "@/domain/settings"

/**
 * Secret key, written straight to the backend (never kept in the browser). A saved value shows only its last 4 chars;
 * the input opens only when changing it.
 */
export function SecretField({ id, name, secret, placeholder }: { id: string; name: SecretName; secret: Secret; placeholder: string }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState("")
  const setSecret = useSetSecret()
  const deleteSecret = useDeleteSecret()
  const error = setSecret.error ?? deleteSecret.error
  const busy = setSecret.isPending || deleteSecret.isPending

  const errorNote = error && <span className="basis-full text-right text-xs text-bad">{error.message}</span>

  if (editing)
    return (
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
        <Input
          id={id}
          type="password"
          autoComplete="off"
          className="h-8 min-w-0 flex-1 text-[13px]"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button
          size="sm"
          disabled={value.trim().length < 8 || busy}
          onClick={() =>
            setSecret.mutate(
              { name, value: value.trim() },
              {
                onSuccess: () => {
                  setValue("")
                  setEditing(false)
                },
              },
            )
          }
        >
          {setSecret.isPending ? "Saving…" : "Set"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => {
            setValue("")
            setSecret.reset()
            setEditing(false)
          }}
        >
          Cancel
        </Button>
        {errorNote}
      </div>
    )

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span className="font-mono text-[13px] text-muted-foreground">{secret.set ? `••••••••${secret.last4 ?? ""}` : "Not set"}</span>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => {
          deleteSecret.reset()
          setEditing(true)
        }}
      >
        {secret.set ? "Replace" : "Add key"}
      </Button>
      {secret.set && (
        <Button variant="ghost" size="sm" className="text-bad hover:text-bad" disabled={busy} onClick={() => deleteSecret.mutate(name)}>
          {deleteSecret.isPending ? "Removing…" : "Remove"}
        </Button>
      )}
      {errorNote}
    </div>
  )
}

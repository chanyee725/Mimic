import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useDeleteSecret, useSetSecret } from "@/api/settings"
import type { Secret, SecretName } from "@/domain/settings"

/** Variable in the station's repo-root .env that holds each secret */
const ENV_VAR: Record<SecretName, string> = {
  hf_token: "HF_TOKEN",
  runpod_api_key: "RUNPOD_API_KEY",
  wandb_api_key: "WANDB_API_KEY",
  slack_webhook: "SLACK_WEBHOOK_URL",
}

/** Row hint for a secret: where the backend stores it, optionally after a short lead */
export function SecretHint({ name, lead }: { name: SecretName; lead?: string }) {
  return (
    <>
      {lead && <>{lead}. </>}
      <code className="font-mono">.env</code> 의 <code className="font-mono">{ENV_VAR[name]}</code> 에 저장됩니다. 화면에는 끝 4자리만
      보입니다.
    </>
  )
}

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

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Secret } from "@/dummy/settings"

/** 비밀 키. 저장된 값은 끝 4자리만 보이고, 바꿀 때만 입력칸을 연다 (값은 백엔드에만 저장) */
export function SecretField({
  id,
  secret,
  placeholder,
  onChange,
}: {
  id: string
  secret: Secret
  placeholder: string
  onChange: (s: Secret) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState("")

  if (editing)
    return (
      <>
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
          disabled={value.trim().length < 8}
          onClick={() => {
            onChange({ set: true, last4: value.trim().slice(-4) })
            setValue("")
            setEditing(false)
          }}
        >
          Set
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </>
    )

  return (
    <>
      <span className="font-mono text-[13px] text-muted-foreground">{secret.set ? `••••••••${secret.last4 ?? ""}` : "Not set"}</span>
      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
        {secret.set ? "Replace" : "Add key"}
      </Button>
      {secret.set && (
        <Button variant="ghost" size="sm" className="text-bad hover:text-bad" onClick={() => onChange({ set: false })}>
          Remove
        </Button>
      )}
    </>
  )
}

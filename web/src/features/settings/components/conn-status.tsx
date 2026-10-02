import { useState } from "react"

import { Button } from "@/components/ui/button"
import { StatusDot } from "@/components/app/status-dot"
import type { ConnState } from "@/dummy/settings"

const LABEL: Record<ConnState, { tone: "ok" | "bad" | "muted"; text: string }> = {
  ok: { tone: "ok", text: "Connected" },
  error: { tone: "bad", text: "Can't connect" },
  unknown: { tone: "muted", text: "Not tested" },
}

/** Connection status + Test button (dummy: shows a result after a short wait) */
export function ConnStatus({ state, detail, canTest = true }: { state: ConnState; detail?: string; canTest?: boolean }) {
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState(state)
  const s = LABEL[result]
  return (
    <div className="flex items-center gap-3">
      <StatusDot tone={testing ? "info" : s.tone} className="text-xs text-muted-foreground">
        {testing ? "Testing…" : detail && result === "ok" ? `${s.text}, ${detail}` : s.text}
      </StatusDot>
      <Button
        variant="outline"
        size="sm"
        disabled={!canTest || testing}
        onClick={() => {
          setTesting(true)
          setTimeout(() => {
            setTesting(false)
            setResult(canTest ? "ok" : "error")
          }, 700)
        }}
      >
        Test
      </Button>
    </div>
  )
}

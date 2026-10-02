import { useState } from "react"

import { StatusDot } from "@/components/app/status-dot"
import { Button } from "@/components/ui/button"
import type { ConnState } from "@/dummy/settings"

const LABEL: Record<ConnState, { tone: "ok" | "bad" | "muted"; text: string }> = {
  ok: { tone: "ok", text: "Connected" },
  error: { tone: "bad", text: "Can't connect" },
  unknown: { tone: "muted", text: "Not tested" },
}

/** 연결 상태 + Test 버튼 (더미: 잠깐 기다렸다 결과를 보여준다) */
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

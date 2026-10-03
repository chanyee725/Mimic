import { Button } from "@/components/ui/button"
import { StatusDot } from "@/components/common/status-dot"
import { useTestConnection } from "@/api/settings"
import type { ConnState, TestTarget } from "@/domain/settings"

const LABEL: Record<ConnState, { tone: "ok" | "bad" | "muted"; text: string }> = {
  ok: { tone: "ok", text: "Connected" },
  error: { tone: "bad", text: "Can't connect" },
  unknown: { tone: "muted", text: "Not tested" },
}

/** Connection status from the settings document + Test button (the server stores the result in the same state) */
export function ConnStatus({
  target,
  state,
  detail,
  canTest = true,
  label = "Test",
}: {
  target: TestTarget
  state: ConnState
  detail?: string
  canTest?: boolean
  label?: string
}) {
  const test = useTestConnection()
  const s = LABEL[state]
  // Why the last test failed (e.g. missing key), straight from the server
  const failure = test.error?.message ?? (test.data?.state === "error" && state === "error" ? test.data.detail : undefined)

  return (
    <div className="grid justify-items-end gap-1">
      <div className="flex items-center gap-3">
        <StatusDot tone={test.isPending ? "info" : s.tone} className="text-xs text-muted-foreground">
          {test.isPending ? "Testing…" : detail && state === "ok" ? `${s.text}, ${detail}` : s.text}
        </StatusDot>
        <Button variant="outline" size="sm" disabled={!canTest || test.isPending} onClick={() => test.mutate(target)}>
          {label}
        </Button>
      </div>
      {failure && <span className="text-xs text-bad">{failure}</span>}
    </div>
  )
}

import { useEffect, useState } from "react"
import { LuHand } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { FINGERS } from "@/dummy/robot"

const PADS = 16 // 손가락당 촉각 패드 4×4

function useMockHand(enabled: boolean) {
  const [t, setT] = useState(0)
  useEffect(() => {
    if (!enabled) return
    // 표시용은 10Hz 정도면 충분. 저장은 장치 원본 주기로 별도 진행.
    const id = setInterval(() => setT((v) => v + 0.1), 100)
    return () => clearInterval(id)
  }, [enabled])
  return t
}

export function HandPanel({ connected, onDemo }: { connected: boolean; onDemo: () => void }) {
  const t = useMockHand(connected)

  if (!connected) {
    return (
      <div className="flex min-h-36 flex-1 flex-col items-center justify-center gap-1.5 rounded-md border border-dashed text-center text-[13px] text-muted-foreground">
        <LuHand className="size-6" />
        <span>Data Glove not connected</span>
        <div className="flex items-center gap-3 text-xs">
          <Button variant="ghost" size="xs" onClick={onDemo}>
            Show demo data
          </Button>
        </div>
      </div>
    )
  }

  const bends = FINGERS.map((_, i) => (Math.sin(t + i * 0.7) + 1) / 2)

  return (
    <div className="grid grid-cols-2 gap-5">
      <div className="grid content-start gap-2.25">
        <span className="text-xs text-muted-foreground">Flex</span>
        {FINGERS.map((f, i) => (
          <div key={f.name} className="grid grid-cols-[48px_minmax(0,1fr)_30px] items-center gap-2 text-xs">
            <span>{f.name}</span>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-series-1" style={{ width: `${bends[i] * 100}%` }} />
            </div>
            <span className="text-right font-mono">{Math.round(bends[i] * 90)}°</span>
          </div>
        ))}
      </div>
      <div className="grid content-start gap-2.25">
        <span className="text-xs text-muted-foreground">Tactile · 4×4 / finger</span>
        <div className="flex justify-between gap-1.5">
          {FINGERS.map((f, i) => (
            <div key={f.name} className="flex flex-col items-center gap-1">
              <div className="grid grid-cols-4 gap-0.5">
                {Array.from({ length: PADS }, (_, k) => (
                  <span
                    key={k}
                    className="size-2.25 rounded-[2px] bg-series-4"
                    style={{ opacity: 0.1 + Math.max(0, Math.sin(t * 1.3 + i * 1.7 + k * 0.9)) * bends[i] * 0.9 }}
                  />
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground">{f.short}</span>
            </div>
          ))}
        </div>
        <span className="pt-1 text-xs text-muted-foreground">IMU · wrist quaternion</span>
        <span className="font-mono text-xs">
          [{[Math.cos(t), Math.sin(t) * 0.5, -0.05, 0.14].map((v) => v.toFixed(2)).join(", ")}]
        </span>
      </div>
    </div>
  )
}

import { useRef } from "react"

import { formatClock } from "@/lib/format"

/** 재생 위치 탐색 바 */
export function Scrubber({ duration: dur, time, onSeek }: { duration: number; time: number; onSeek: (t: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const pct = (t: number) => `${(t / dur) * 100}%`

  const seekFromEvent = (clientX: number) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    onSeek(Math.min(dur, Math.max(0, ((clientX - r.left) / r.width) * dur)))
  }

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="Playback position"
      aria-valuemin={0}
      aria-valuemax={dur}
      aria-valuenow={+time.toFixed(1)}
      aria-valuetext={formatClock(time, { tenths: true })}
      onPointerDown={(e) => {
        dragging.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
        seekFromEvent(e.clientX)
      }}
      onPointerMove={(e) => dragging.current && seekFromEvent(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 5 : 1
        if (e.key === "ArrowRight") onSeek(Math.min(dur, time + step))
        else if (e.key === "ArrowLeft") onSeek(Math.max(0, time - step))
        else if (e.key === "Home") onSeek(0)
        else if (e.key === "End") onSeek(dur)
        else return
        e.preventDefault()
      }}
      className="group relative flex h-8 min-w-0 flex-1 cursor-pointer touch-none items-center rounded-md outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <div className="relative h-1.5 w-full rounded-full bg-muted">
        <div className="absolute inset-y-0 left-0 rounded-full bg-foreground" style={{ width: pct(time) }} />
        <span
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground shadow-sm"
          style={{ left: pct(time) }}
        />
      </div>
    </div>
  )
}

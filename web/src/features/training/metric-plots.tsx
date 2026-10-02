import { useEffect, useRef, useState } from "react"
import { LuMaximize2 } from "react-icons/lu"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

import type { JobRun, SeriesKey } from "./job-run"

export type MetricLine = {
  key: SeriesKey
  label: string
  /** CSS 변수 이름 (--series-1 등) */
  color: string
  dashed?: boolean
  /** 원본 값을 옅게 깔 때 (smoothing 된 선 아래) */
  faint?: boolean
}

export type Metric = {
  title: string
  lines: MetricLine[]
  format: (v: number) => string
  /** y 축 하한을 0 으로 고정 */
  zero?: boolean
  /** y 축 상한 (예: 100%) */
  max?: number
}

const PAD = { left: 40, right: 8, top: 18, bottom: 16 }
const STEP_TICKS = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000]

const stepLabel = (s: number) => (s >= 1000 ? `${s / 1000}k` : String(s))

/**
 * Capture 의 JointPlots 와 같은 모양의 학습 지표 플롯.
 * 지표 하나당 플롯 하나, x 축은 step (0 → 현재), 오른쪽 위에 최신 값.
 * 하나의 rAF 루프가 step 이 늘어날 때만 다시 그린다 (step 마다 React state 를 쓰지 않음).
 */
export function MetricPlots({
  run,
  metrics,
  live,
  single = false,
  className,
}: {
  run: JobRun
  metrics: Metric[]
  live: boolean
  /** 확대 모달 안의 플롯 하나 */
  single?: boolean
  className?: string
}) {
  const canvases = useRef<(HTMLCanvasElement | null)[]>([])
  const [expanded, setExpanded] = useState<Metric | null>(null)

  useEffect(() => {
    const first = canvases.current[0]
    if (!first) return
    const css = getComputedStyle(first)
    const v = (name: string) => css.getPropertyValue(name).trim()
    const color = { grid: v("--border"), text: v("--muted-foreground"), cursor: v("--foreground") }
    const font = css.fontFamily

    const drawPlot = (canvas: HTMLCanvasElement, m: Metric) => {
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const n = run.count
      const x0 = PAD.left
      const x1 = w - PAD.right
      const y0 = PAD.top
      const y1 = h - PAD.bottom
      ctx.font = `10px ${font}`
      ctx.lineWidth = 1
      if (n < 2) return

      // 화면 폭(px) 만큼의 구간 평균으로 줄여서 그린다
      const cols = Math.max(2, Math.floor(x1 - x0))
      const reduce = (buf: Float32Array) => {
        const out = new Float32Array(Math.min(cols, n))
        const per = n / out.length
        for (let c = 0; c < out.length; c++) {
          const a = Math.floor(c * per)
          const b = Math.max(a + 1, Math.floor((c + 1) * per))
          let sum = 0
          for (let k = a; k < b; k++) sum += buf[k]
          out[c] = sum / (b - a)
        }
        return out
      }
      const lines = m.lines.map((l) => ({ ...l, pts: reduce(run.data[l.key]) }))

      let lo = Infinity
      let hi = -Infinity
      for (const l of lines)
        for (const p of l.pts) {
          lo = Math.min(lo, p)
          hi = Math.max(hi, p)
        }
      if (m.zero) lo = 0
      if (hi - lo < 1e-12) hi = lo + 1
      const span = hi - lo
      hi = m.max !== undefined ? Math.min(m.max, hi + span * 0.08) : hi + span * 0.08
      if (!m.zero) lo -= span * 0.08
      const yOf = (val: number) => y0 + ((hi - val) / (hi - lo)) * (y1 - y0)

      // y 눈금: 아래 · 가운데 · 위
      ctx.textAlign = "right"
      ctx.textBaseline = "middle"
      for (const val of [lo, (lo + hi) / 2, hi]) {
        ctx.strokeStyle = color.grid
        ctx.beginPath()
        ctx.moveTo(x0, yOf(val))
        ctx.lineTo(x1, yOf(val))
        ctx.stroke()
        ctx.fillStyle = color.text
        ctx.fillText(m.format(val), x0 - 4, yOf(val))
      }

      // x 눈금: step, 최대 5개
      const tick = STEP_TICKS.find((t) => n / t <= 5) ?? 100000
      ctx.textAlign = "center"
      ctx.textBaseline = "top"
      for (let s = 0; s < n; s += tick) {
        const x = x0 + (s / (n - 1)) * (x1 - x0)
        ctx.strokeStyle = color.grid
        ctx.globalAlpha = 0.5
        ctx.beginPath()
        ctx.moveTo(x, y0)
        ctx.lineTo(x, y1)
        ctx.stroke()
        ctx.globalAlpha = 1
        if (x < x1 - 24) {
          ctx.fillStyle = color.text
          ctx.fillText(stepLabel(s), x, y1 + 3)
        }
      }

      for (const l of lines) {
        ctx.strokeStyle = v(l.color)
        ctx.globalAlpha = l.faint ? 0.25 : 1
        ctx.lineWidth = l.dashed ? 1.25 : 1.5
        ctx.setLineDash(l.dashed ? [4, 3] : [])
        ctx.beginPath()
        l.pts.forEach((p, c) => {
          const x = x0 + (c / (l.pts.length - 1)) * (x1 - x0)
          if (c) ctx.lineTo(x, yOf(p))
          else ctx.moveTo(x, yOf(p))
        })
        ctx.stroke()
      }
      ctx.setLineDash([])
      ctx.globalAlpha = 1

      // 현재 step 커서
      if (live) {
        ctx.strokeStyle = color.cursor
        ctx.globalAlpha = 0.35
        ctx.beginPath()
        ctx.moveTo(x1, y0 - 4)
        ctx.lineTo(x1, y1)
        ctx.stroke()
        ctx.globalAlpha = 1
      }

      // 범례 + 최신 값 (오른쪽 위). 옅은 원본 선은 범례에서 뺀다
      ctx.textBaseline = "middle"
      ctx.textAlign = "right"
      let x = x1
      for (const l of [...m.lines].reverse()) {
        if (l.faint) continue
        const label = `${l.label} ${m.format(run.data[l.key][n - 1])}`
        ctx.fillStyle = color.cursor
        ctx.fillText(label, x, PAD.top / 2)
        const tw = ctx.measureText(label).width
        ctx.fillStyle = v(l.color)
        ctx.fillRect(x - tw - 10, PAD.top / 2 - 3, 6, 6)
        x -= tw + 20
      }
    }

    let drawn = -1
    let size = ""
    let raf = 0
    const loop = () => {
      const sz = canvases.current.map((c) => `${c?.clientWidth}x${c?.clientHeight}`).join()
      if (run.count !== drawn || sz !== size) {
        canvases.current.forEach((c, i) => c && i < metrics.length && drawPlot(c, metrics[i]))
        drawn = run.count
        size = sz
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [run, metrics, live])

  return (
    <>
      <div
        className={cn(
          "grid min-h-0 gap-2",
          single ? "grid-cols-1" : "auto-rows-[minmax(8.5rem,1fr)] overflow-y-auto sm:grid-cols-2 xl:grid-cols-3",
          className,
        )}
      >
        {metrics.map((m, i) => (
          <figure key={m.title} className="group m-0 flex min-h-0 flex-col rounded-md border bg-card px-2 pt-1.5 pb-1">
            {!single && (
              <figcaption className="flex items-center justify-between gap-2">
                <span className="truncate text-[11px] font-medium">{m.title}</span>
                <button
                  type="button"
                  onClick={() => setExpanded(m)}
                  className="-mr-1 grid size-5 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label={`Expand ${m.title}`}
                  title="Expand"
                >
                  <LuMaximize2 className="size-3" />
                </button>
              </figcaption>
            )}
            <canvas
              ref={(el) => {
                canvases.current[i] = el
              }}
              className="min-h-0 w-full flex-1"
              aria-label={m.title}
            />
          </figure>
        ))}
      </div>

      {!single && (
        <Dialog open={expanded !== null} onOpenChange={(o) => !o && setExpanded(null)}>
          <DialogContent className="gap-3 sm:max-w-[min(72rem,92vw)]">
            <DialogHeader>
              <DialogTitle>{expanded?.title}</DialogTitle>
            </DialogHeader>
            {expanded && <MetricPlots run={run} metrics={[expanded]} live={live} single className="h-[65svh]" />}
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

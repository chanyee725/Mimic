import { useEffect, useRef, useState } from "react"
import { LuMaximize2 } from "react-icons/lu"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cssVar, drawCursor, drawLegend, drawLine, drawXGrid, drawYGrid, prepareCanvas } from "@/components/robot/plot-canvas"
import { cn } from "@/lib/utils"

import type { JobRun, Metric } from "../lib"

const PAD_LEFT = 40
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
    const v = (name: string) => cssVar(first, name)
    const color = { grid: v("--border"), text: v("--muted-foreground"), cursor: v("--foreground") }
    const font = getComputedStyle(first).fontFamily

    const drawPlot = (canvas: HTMLCanvasElement, m: Metric) => {
      const f = prepareCanvas(canvas, PAD_LEFT)
      if (!f) return
      const { ctx, x0, x1, y0, y1 } = f
      const n = run.count
      ctx.font = `10px ${font}`
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
      drawYGrid(
        f,
        [lo, (lo + hi) / 2, hi].map((val) => ({ y: yOf(val), label: m.format(val) })),
        color.grid,
        color.text,
      )

      // x 눈금: step, 최대 5개. 오른쪽 끝에 붙은 라벨은 생략
      const tick = STEP_TICKS.find((t) => n / t <= 5) ?? 100000
      const xTicks: { x: number; label?: string }[] = []
      for (let s = 0; s < n; s += tick) {
        const x = x0 + (s / (n - 1)) * (x1 - x0)
        xTicks.push({ x, label: x < x1 - 24 ? stepLabel(s) : undefined })
      }
      drawXGrid(f, xTicks, color.grid, color.text)

      const points = function* (pts: Float32Array): Generator<[number, number]> {
        for (let c = 0; c < pts.length; c++) yield [x0 + (c / (pts.length - 1)) * (x1 - x0), yOf(pts[c])]
      }
      for (const l of lines) drawLine(f, points(l.pts), v(l.color), { dashed: l.dashed, alpha: l.faint ? 0.25 : 1 })

      // 현재 step 커서
      if (live) drawCursor(f, color.cursor)

      // 범례 + 최신 값 (오른쪽 위). 옅은 원본 선은 범례에서 뺀다
      drawLegend(
        f,
        [...m.lines]
          .reverse()
          .filter((l) => !l.faint)
          .map((l) => ({ label: `${l.label} ${m.format(run.data[l.key][n - 1])}`, color: v(l.color) })),
        color.cursor,
      )
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

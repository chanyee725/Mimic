import { useEffect, useMemo, useRef } from "react"
import { LuActivity } from "react-icons/lu"

import type { RecordingSamples } from "@/domain/recording"
import { cn } from "@/lib/utils"

import { drawCursor, drawLegend, drawLine, drawXGrid, drawYGrid, prepareCanvas } from "./plot-canvas"

type Props = {
  /** Joint names defined by the rig (action / observation.state vector order); the data's own joints win when given */
  joints: readonly string[]
  /** Recorded (playback) or target (live) rate, shown in the legend */
  hz: number
  /** Visible time window (seconds) */
  windowSec?: number
  /** Device names shown in the legend (e.g. SO-101 Leader / SO-101 Follower) */
  actionSource?: string
  stateSource?: string
  /** Joint series to draw. Without it the plots show "No signal" (there is no live joint stream yet) */
  data?: RecordingSamples | null
  /**
   * Playback mode: returns the current playback position (s). When given, draws the
   * last windowSec up to that position; otherwise the window ends at the last sample
   */
  playhead?: () => number
  /** Replaces "No signal" while there is no data (e.g. "Loading…") */
  emptyLabel?: string
  /** Korean hint under the empty label */
  hint?: string
  className?: string
}

const PAD_LEFT = 30

/** y range covering ±90° and the data, rounded out to 30° steps */
function rangeOf(series: number[][][]) {
  let lo = -90
  let hi = 90
  for (const topic of series)
    for (const joint of topic)
      for (const v of joint) {
        if (v < lo) lo = v
        if (v > hi) hi = v
      }
  return { min: Math.floor(lo / 30) * 30, max: Math.ceil(hi / 30) * 30 }
}

/**
 * Per-joint plots modelled on Rerun's time series view.
 * Each joint gets one plot with action (solid) over observation.state (dashed),
 * a shared time axis, y ticks, a current-time cursor and a latest-value legend.
 * All plots share one rAF loop that reads the playhead directly (no React state per frame).
 */
export function JointPlots({
  joints,
  hz,
  windowSec = 5,
  actionSource,
  stateSource,
  data,
  playhead,
  emptyLabel = "No signal",
  hint = "장치가 연결되면 관절값이 표시됩니다.",
  className,
}: Props) {
  const canvases = useRef<(HTMLCanvasElement | null)[]>([])
  const names = data?.joints.length ? data.joints : joints
  const hasData = !!data && data.t.length > 0 && !!(data.series.action || data.series.state)
  const range = useMemo(() => (data ? rangeOf([data.series.action ?? [], data.series.state ?? []]) : { min: -90, max: 90 }), [data])

  useEffect(() => {
    if (!hasData || !data) return
    const first = canvases.current[0]
    if (!first) return
    const css = getComputedStyle(first)
    const color = {
      action: css.getPropertyValue("--series-1").trim(),
      state: css.getPropertyValue("--series-3").trim(),
      grid: css.getPropertyValue("--border").trim(),
      text: css.getPropertyValue("--muted-foreground").trim(),
      cursor: css.getPropertyValue("--foreground").trim(),
    }
    const font = css.fontFamily
    const { t, series } = data
    const t0 = t[0]
    const step = t.length > 1 ? t[1] - t[0] : 1 / hz
    const count = Math.max(2, Math.round(windowSec / step))
    const { min, max } = range
    let raf = 0

    const drawPlot = (canvas: HTMLCanvasElement, i: number, end: number) => {
      const f = prepareCanvas(canvas, PAD_LEFT)
      if (!f) return
      const { ctx, x0, x1, y0, y1 } = f
      const yOf = (v: number) => y0 + ((max - v) / (max - min)) * (y1 - y0)
      const xOf = (j: number) => x0 + (j / (count - 1)) * (x1 - x0)
      ctx.font = `10px ${font}`

      drawYGrid(
        f,
        [min, 0, max].map((v) => ({ y: yOf(v), label: `${v}°` })),
        color.grid,
        color.text,
      )
      // x ticks every second, right edge is the playhead; the leftmost label is skipped because it overlaps the min tick
      drawXGrid(
        f,
        Array.from({ length: windowSec + 1 }, (_, s) => ({
          x: x1 - (s / windowSec) * (x1 - x0),
          label: s === windowSec ? undefined : s === 0 ? "now" : `-${s}s`,
        })),
        color.grid,
        color.text,
      )

      // Sample index at the right edge; indexes before the first sample are gaps
      const last = Math.min(t.length - 1, Math.floor((end - t0) / step + 1e-6))
      const valueAt = (buf: number[] | undefined, k: number) => (buf && k >= 0 && k < buf.length ? buf[k] : Number.NaN)
      const points = function* (buf: number[] | undefined): Generator<[number, number]> {
        for (let j = 0; j < count; j++) yield [xOf(j), yOf(valueAt(buf, last - count + 1 + j))]
      }
      const state = series.state?.[i]
      const action = series.action?.[i]
      if (state) drawLine(f, points(state), color.state, { dashed: true })
      if (action) drawLine(f, points(action), color.action)
      drawCursor(f, color.cursor)

      const latest = (buf: number[] | undefined) => {
        const v = valueAt(buf, last)
        return Number.isNaN(v) ? "—" : `${v.toFixed(1)}°`
      }
      drawLegend(
        f,
        [
          ...(state ? [{ label: `obs ${latest(state)}`, color: color.state }] : []),
          ...(action ? [{ label: `act ${latest(action)}`, color: color.action }] : []),
        ],
        color.cursor,
      )
    }

    const draw = () => {
      const end = playhead ? playhead() : t[t.length - 1]
      canvases.current.forEach((c, i) => c && i < names.length && drawPlot(c, i, end))
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [data, hasData, names, hz, windowSec, playhead, range])

  return (
    <div className={cn("flex min-h-0 flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded-full bg-series-1" />
          Action{actionSource ? ` (${actionSource})` : ""}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded-full border-t border-dashed border-series-3" />
          Observation{stateSource ? ` (${stateSource})` : ""}
        </span>
        <span className="ml-auto">{playhead ? `Recorded at ${hz} Hz` : `Target ${hz} Hz`}</span>
      </div>

      {hasData ? (
        <div className="grid min-h-0 flex-1 auto-rows-[minmax(7rem,1fr)] gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
          {names.map((j, i) => (
            <figure key={j} className="m-0 flex min-h-0 flex-col rounded-md border bg-card px-2 pt-1.5 pb-1">
              <figcaption className="truncate text-[11px] font-medium">{j}</figcaption>
              <canvas
                ref={(el) => {
                  canvases.current[i] = el
                }}
                className="min-h-0 w-full flex-1"
                aria-label={`${j} action and observation`}
              />
            </figure>
          ))}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 rounded-md border bg-card px-4 text-center text-xs text-muted-foreground">
          <LuActivity className="mb-0.5 size-5" />
          <span className="font-medium text-foreground">{emptyLabel}</span>
          {hint}
        </div>
      )}
    </div>
  )
}

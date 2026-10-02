import { useEffect, useRef } from "react"

import { cn } from "@/lib/utils"

import { drawCursor, drawLegend, drawLine, drawXGrid, drawYGrid, prepareCanvas } from "./plot-canvas"

type Props = {
  /** Joint names defined by the rig (action / observation.state vector order) */
  joints: readonly string[]
  /** Sample rate (Hz). Only used to generate mock data */
  hz: number
  /** Visible time window (seconds) */
  windowSec?: number
  /** Device names shown in the legend (e.g. SO-101 Leader / SO-101 Follower) */
  actionSource?: string
  stateSource?: string
  /**
   * Playback mode: returns the current playback position (s). When given, draws the
   * last windowSec up to that position instead of live data (MCAP playback in Review)
   */
  playhead?: () => number
  /** Per-file value (0–1) so each recording replays a different trajectory */
  seed?: number
  className?: string
}

const Y_MIN = -90
const Y_MAX = 90
const PAD_LEFT = 30

/**
 * Per-joint plots modelled on Rerun's time series view.
 * Each joint gets one plot with action (solid) over observation.state (dashed),
 * a shared time axis, y ticks, a current-time cursor and a latest-value legend.
 * All plots share one rAF loop and ring buffer (no React state per sample).
 */
export function JointPlots({ joints, hz, windowSec = 5, actionSource, stateSource, playhead, seed = 0, className }: Props) {
  const canvases = useRef<(HTMLCanvasElement | null)[]>([])
  // Measured receive rate. Only the DOM text is updated every 0.5 s (no React state)
  const actionRate = useRef<HTMLSpanElement>(null)
  const stateRate = useRef<HTMLSpanElement>(null)

  useEffect(() => {
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

    const capacity = hz * windowSec
    const action = joints.map(() => new Float32Array(capacity))
    const state = joints.map(() => new Float32Array(capacity))
    let head = 0
    let t = 0
    let last = performance.now()
    let raf = 0
    // Receive timestamps (ms); the measured rate uses the last 2 s
    const stamps = { action: [] as number[], state: [] as number[] }
    let rateAt = last

    // Mock signal: angles (°) with a different period/phase per joint; state lags action by 0.15 s
    const sample = (i: number, time: number) =>
      (Math.sin(time * (0.55 + (i % 6) * 0.22) + i + seed * 6) * 0.7 + Math.sin(time * 2.7 + i + seed) * 0.08) * Y_MAX

    for (let k = 0; k < capacity; k++) {
      t += 1 / hz
      for (let i = 0; i < joints.length; i++) {
        action[i][k] = sample(i, t)
        state[i][k] = sample(i, t - 0.15)
      }
    }

    const drawPlot = (canvas: HTMLCanvasElement, i: number) => {
      const f = prepareCanvas(canvas, PAD_LEFT)
      if (!f) return
      const { ctx, x0, x1, y0, y1 } = f
      const yOf = (v: number) => y0 + ((Y_MAX - v) / (Y_MAX - Y_MIN)) * (y1 - y0)
      const xOf = (j: number) => x0 + (j / (capacity - 1)) * (x1 - x0)
      ctx.font = `10px ${font}`

      // y ticks: -90 / 0 / 90°
      drawYGrid(
        f,
        [Y_MIN, 0, Y_MAX].map((v) => ({ y: yOf(v), label: `${v}°` })),
        color.grid,
        color.text,
      )
      // x ticks every second, right edge is now; the leftmost label is skipped because it overlaps the -90° tick
      drawXGrid(
        f,
        Array.from({ length: windowSec + 1 }, (_, s) => ({
          x: x1 - (s / windowSec) * (x1 - x0),
          label: s === windowSec ? undefined : s === 0 ? "now" : `-${s}s`,
        })),
        color.grid,
        color.text,
      )

      const points = function* (buf: Float32Array): Generator<[number, number]> {
        for (let j = 0; j < capacity; j++) yield [xOf(j), yOf(buf[(head + j) % capacity])]
      }
      drawLine(f, points(state[i]), color.state, { dashed: true })
      drawLine(f, points(action[i]), color.action)
      drawCursor(f, color.cursor)

      // Legend with latest values (top right)
      const latest = (buf: Float32Array) => {
        const v = buf[(head - 1 + capacity) % capacity]
        return Number.isNaN(v) ? 0 : v
      }
      drawLegend(
        f,
        [
          { label: `obs ${latest(state[i]).toFixed(1)}°`, color: color.state },
          { label: `act ${latest(action[i]).toFixed(1)}°`, color: color.action },
        ],
        color.cursor,
      )
    }

    const draw = (now: number) => {
      if (playhead) {
        // Playback mode: refill the window ending at the playhead (empty before 0 s)
        const end = playhead()
        for (let k = 0; k < capacity; k++) {
          const tk = end - windowSec + (k + 1) / hz
          for (let i = 0; i < joints.length; i++) {
            action[i][k] = tk < 0 ? Number.NaN : sample(i, tk)
            state[i][k] = tk < 0.15 ? Number.NaN : sample(i, tk - 0.15)
          }
        }
        head = 0
        canvases.current.forEach((c, i) => c && i < joints.length && drawPlot(c, i))
        raf = requestAnimationFrame(draw)
        return
      }
      const n = Math.floor(((now - last) / 1000) * hz)
      // Advance time only by the samples generated so fractional remainders are kept
      last += (n * 1000) / hz
      for (let k = 0; k < Math.min(n, capacity); k++) {
        t += 1 / hz
        for (let i = 0; i < joints.length; i++) {
          action[i][head] = sample(i, t)
          state[i][head] = sample(i, t - 0.15)
        }
        head = (head + 1) % capacity
        // Mock receive: simulate slight jitter and occasional dropped packets
        const ts = t * 1000
        if (Math.random() > 0.01) stamps.action.push(ts + (Math.random() - 0.5) * 2)
        if (Math.random() > 0.015) stamps.state.push(ts + 150 + (Math.random() - 0.5) * 3)
      }
      if (now - rateAt >= 500) {
        const rateOf = (xs: number[]) => {
          const end = xs[xs.length - 1]
          while (xs.length && xs[0] < end - 2000) xs.shift()
          return xs.length > 1 ? ((xs.length - 1) * 1000) / (end - xs[0]) : 0
        }
        if (actionRate.current) actionRate.current.textContent = `${rateOf(stamps.action).toFixed(1)} Hz`
        if (stateRate.current) stateRate.current.textContent = `${rateOf(stamps.state).toFixed(1)} Hz`
        rateAt = now
      }
      canvases.current.forEach((c, i) => c && i < joints.length && drawPlot(c, i))
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [joints, hz, windowSec, playhead, seed])

  return (
    <div className={cn("flex min-h-0 flex-col gap-2", className)}>
      {/* Legend with measured receive rates */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded-full bg-series-1" />
          Action{actionSource ? ` (${actionSource})` : ""}
          <span ref={actionRate} className="text-foreground">
            {hz.toFixed(1)} Hz
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded-full border-t border-dashed border-series-3" />
          Observation{stateSource ? ` (${stateSource})` : ""}
          <span ref={stateRate} className="text-foreground">
            {hz.toFixed(1)} Hz
          </span>
        </span>
        <span className="ml-auto">{playhead ? `Recorded at ${hz} Hz` : `Target ${hz} Hz`}</span>
      </div>

      <div className="grid min-h-0 flex-1 auto-rows-[minmax(7rem,1fr)] gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
        {joints.map((j, i) => (
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
    </div>
  )
}

import { useEffect, useRef } from "react"

import { cn } from "@/lib/utils"

import { drawCursor, drawLegend, drawLine, drawXGrid, drawYGrid, prepareCanvas } from "./plot-canvas"

type Props = {
  /** Rig 에 정의된 joint 이름 (action / observation.state 벡터 순서) */
  joints: readonly string[]
  /** 샘플 주기 (Hz). 목업 데이터 생성에만 사용 */
  hz: number
  /** 화면에 보여줄 시간 창 (초) */
  windowSec?: number
  /** 범례에 붙는 장치 이름 (예: SO-101 Leader / SO-101 Follower) */
  actionSource?: string
  stateSource?: string
  /**
   * 재생 모드: 현재 재생 위치(초)를 돌려주는 함수. 주면 실시간 수신 대신
   * 재생 위치까지의 최근 windowSec 구간을 그린다 (Review 의 MCAP 재생용)
   */
  playhead?: () => number
  /** 재생 모드에서 파일마다 다른 궤적을 만들기 위한 값 (0–1) */
  seed?: number
  className?: string
}

const Y_MIN = -90
const Y_MAX = 90
const PAD_LEFT = 30

/**
 * Rerun 의 time series view 를 본뜬 joint 별 플롯.
 * joint 하나당 플롯 하나에 action(실선)과 observation.state(점선)를 겹쳐 그리고,
 * 공통 시간축 · y 눈금 · 현재 시각 커서 · 최신 값 범례를 표시한다.
 * 모든 플롯은 하나의 rAF 루프와 ring buffer 를 공유한다 (샘플마다 React state 를 쓰지 않음).
 */
export function JointPlots({ joints, hz, windowSec = 5, actionSource, stateSource, playhead, seed = 0, className }: Props) {
  const canvases = useRef<(HTMLCanvasElement | null)[]>([])
  // 실측 수신 주기. 0.5 s 마다 DOM 텍스트만 갱신한다 (React state 를 쓰지 않음)
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
    // 수신 타임스탬프(ms). 최근 2 s 구간으로 실측 주기를 계산한다
    const stamps = { action: [] as number[], state: [] as number[] }
    let rateAt = last

    // 목업 신호: joint 마다 주기·위상이 다른 각도(°). state 는 action 을 0.15 s 늦게 따라간다
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

      // y 눈금: -90 · 0 · 90°
      drawYGrid(
        f,
        [Y_MIN, 0, Y_MAX].map((v) => ({ y: yOf(v), label: `${v}°` })),
        color.grid,
        color.text,
      )
      // x 눈금: 1 초 간격, 오른쪽 끝이 현재 시각. 가장 왼쪽 라벨은 y 눈금(-90°)과 겹치므로 생략
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

      // 범례 + 최신 값 (오른쪽 위)
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
        // 재생 모드: 재생 위치까지의 최근 구간을 다시 채운다 (0 초 이전은 비움)
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
      // 남는 소수 구간을 버리지 않도록 생성한 샘플 수만큼만 시간을 진행시킨다
      last += (n * 1000) / hz
      for (let k = 0; k < Math.min(n, capacity); k++) {
        t += 1 / hz
        for (let i = 0; i < joints.length; i++) {
          action[i][head] = sample(i, t)
          state[i][head] = sample(i, t - 0.15)
        }
        head = (head + 1) % capacity
        // 목업 수신: 약간의 지터와 드물게 빠지는 패킷을 흉내 낸다
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
      {/* 범례 + 실측 수신 주기 */}
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

import { useEffect, useRef } from "react"

type Props = {
  series: readonly string[]
  /** 샘플 주기 (Hz). 목업 데이터 생성에만 사용. */
  hz: number
  /** 화면에 보여줄 시간 창 (초) */
  windowSec?: number
  height?: number
}

const SERIES_VARS = ["--series-1", "--series-2", "--series-3", "--series-4", "--series-5", "--series-6"]

/**
 * 고주파 시계열 캔버스. 실선 = leader action, 점선 = follower state.
 * React state 를 거치지 않고 ring buffer 에 쌓은 뒤 rAF 에서 직접 그린다.
 * 실제 구현에서는 DataChannel → Worker(protobuf 디코딩) → ring buffer 로 채운다.
 */
export function TimeSeries({ series, hz, windowSec = 5, height = 140 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return

    const css = getComputedStyle(canvas)
    const colors = series.map((_, i) => css.getPropertyValue(SERIES_VARS[i % SERIES_VARS.length]).trim())
    const grid = css.getPropertyValue("--border").trim()

    const capacity = hz * windowSec
    const action = series.map(() => new Float32Array(capacity))
    const state = series.map(() => new Float32Array(capacity))
    let head = 0
    let t = 0
    let last = performance.now()
    let raf = 0

    const sample = (i: number, time: number) =>
      Math.sin(time * (0.55 + i * 0.22) + i) * 0.75 + Math.sin(time * 2.7 + i) * 0.08

    // 첫 프레임부터 시간 창이 채워져 보이도록 미리 한 바퀴 채운다
    for (let k = 0; k < capacity; k++) {
      t += 1 / hz
      for (let i = 0; i < series.length; i++) {
        action[i][k] = sample(i, t)
        state[i][k] = sample(i, t - 0.15)
      }
    }

    const plot = (buf: Float32Array, w: number, h: number) => {
      ctx.beginPath()
      for (let j = 0; j < capacity; j++) {
        const v = buf[(head + j) % capacity]
        const x = (j / (capacity - 1)) * w
        const y = h / 2 - v * (h / 2 - 6)
        if (j === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    const draw = (now: number) => {
      // 목업: 경과 시간만큼 hz 로 샘플 생성
      const n = Math.floor(((now - last) / 1000) * hz)
      if (n > 0) last = now
      for (let k = 0; k < Math.min(n, capacity); k++) {
        t += 1 / hz
        for (let i = 0; i < series.length; i++) {
          action[i][head] = sample(i, t)
          state[i][head] = sample(i, t - 0.15)
        }
        head = (head + 1) % capacity
      }

      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr
        canvas.height = h * dpr
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      ctx.strokeStyle = grid
      ctx.lineWidth = 1
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(0, h / 2)
      ctx.lineTo(w, h / 2)
      ctx.stroke()

      for (let i = 0; i < series.length; i++) {
        ctx.strokeStyle = colors[i]
        ctx.globalAlpha = 0.55
        ctx.lineWidth = 1
        ctx.setLineDash([3, 3])
        plot(state[i], w, h)
        ctx.globalAlpha = 1
        ctx.lineWidth = 1.5
        ctx.setLineDash([])
        plot(action[i], w, h)
      }

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [series, hz, windowSec])

  return (
    <div className="grid gap-3">
      <canvas ref={canvasRef} className="w-full" style={{ height }} aria-label="Joint values chart" />
      <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
        {series.map((s, i) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className="size-2 rounded-xs" style={{ background: `var(${SERIES_VARS[i % SERIES_VARS.length]})` }} />
            {s}
          </span>
        ))}
      </div>
    </div>
  )
}

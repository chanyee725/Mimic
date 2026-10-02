import { useEffect, useRef } from "react"

import { cn } from "@/lib/utils"

type Props = {
  /** Rig 에 정의된 joint 이름 (6축 또는 양팔 12축) */
  series: readonly string[]
  /** 샘플 주기 (Hz). 목업 데이터 생성에만 사용. */
  hz: number
  /** action = leader 명령, state = follower 관측값 */
  signal: "action" | "state"
  /** 화면에 보여줄 시간 창 (초) */
  windowSec?: number
  className?: string
}

const SERIES_VARS = ["--series-1", "--series-2", "--series-3", "--series-4", "--series-5", "--series-6"]

/** 양팔 rig 은 left_/right_ 접두어를 떼고 같은 관절은 같은 색으로 맞춘다 */
const baseName = (joint: string) => joint.replace(/^(left|right)_/, "")
const isRight = (joint: string) => joint.startsWith("right_")

/**
 * 고주파 시계열 캔버스 (action 또는 state 한 종류).
 * React state 를 거치지 않고 ring buffer 에 쌓은 뒤 rAF 에서 직접 그린다.
 * 실제 구현에서는 DataChannel → Worker(protobuf 디코딩) → ring buffer 로 채운다.
 */
export function TimeSeries({ series, hz, signal, windowSec = 5, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const bases = Array.from(new Set(series.map(baseName)))
  const bimanual = series.some((s) => s !== baseName(s))
  const colorVar = (joint: string) => SERIES_VARS[bases.indexOf(baseName(joint)) % SERIES_VARS.length]

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return

    const css = getComputedStyle(canvas)
    const jointBases = Array.from(new Set(series.map(baseName)))
    const colors = series.map((s) =>
      css.getPropertyValue(SERIES_VARS[jointBases.indexOf(baseName(s)) % SERIES_VARS.length]).trim(),
    )
    const dashed = series.map(isRight)
    const grid = css.getPropertyValue("--border").trim()
    // state 는 follower 가 leader 를 약간 늦게 따라가는 것으로 흉내 낸다
    const delay = signal === "state" ? 0.15 : 0

    const capacity = hz * windowSec
    const buf = series.map(() => new Float32Array(capacity))
    let head = 0
    let t = 0
    let last = performance.now()
    let raf = 0

    const sample = (i: number, time: number) => {
      const k = jointBases.indexOf(baseName(series[i]))
      const phase = isRight(series[i]) ? 0.9 : 0
      return Math.sin(time * (0.55 + k * 0.22) + k + phase) * 0.75 + Math.sin(time * 2.7 + k) * 0.08
    }

    // 첫 프레임부터 시간 창이 채워져 보이도록 미리 한 바퀴 채운다
    for (let k = 0; k < capacity; k++) {
      t += 1 / hz
      for (let i = 0; i < series.length; i++) buf[i][k] = sample(i, t - delay)
    }

    const plot = (b: Float32Array, w: number, h: number) => {
      ctx.beginPath()
      for (let j = 0; j < capacity; j++) {
        const v = b[(head + j) % capacity]
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
        for (let i = 0; i < series.length; i++) buf[i][head] = sample(i, t - delay)
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

      ctx.lineWidth = 1.5
      for (let i = 0; i < series.length; i++) {
        ctx.strokeStyle = colors[i]
        ctx.setLineDash(dashed[i] ? [4, 3] : [])
        plot(buf[i], w, h)
      }
      ctx.setLineDash([])

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [series, hz, signal, windowSec])

  return (
    <div className={cn("flex min-h-0 flex-col gap-2.5", className)}>
      <canvas
        ref={canvasRef}
        className="min-h-24 w-full flex-1"
        aria-label={`${signal === "action" ? "Action" : "Observation state"} joint values`}
      />
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
        {bases.map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className="size-2 rounded-xs" style={{ background: `var(${colorVar(s)})` }} />
            {s}
          </span>
        ))}
        {bimanual && <span className="ml-auto text-muted-foreground/80">solid = left · dashed = right</span>}
      </div>
    </div>
  )
}

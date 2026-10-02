// Capture 관절 그래프와 Training 지표 그래프가 같이 쓰는 캔버스 그리기 함수 (React 없음).

export const PLOT_PAD = { right: 8, top: 18, bottom: 16 }

export type PlotFrame = { ctx: CanvasRenderingContext2D; w: number; h: number; x0: number; x1: number; y0: number; y1: number }

/** devicePixelRatio 에 맞춰 캔버스 크기를 맞추고 지운 뒤, 그릴 영역을 돌려준다 */
export function prepareCanvas(canvas: HTMLCanvasElement, padLeft: number): PlotFrame | null {
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  const dpr = window.devicePixelRatio || 1
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  ctx.lineWidth = 1
  ctx.setLineDash([])
  return { ctx, w, h, x0: padLeft, x1: w - PLOT_PAD.right, y0: PLOT_PAD.top, y1: h - PLOT_PAD.bottom }
}

/** CSS 변수 값을 읽는다 (--series-1 등) */
export function cssVar(el: Element, name: string) {
  return getComputedStyle(el).getPropertyValue(name).trim()
}

/** 가로 보조선 + 왼쪽 눈금 글자 */
export function drawYGrid(f: PlotFrame, ticks: { y: number; label: string }[], grid: string, text: string) {
  const { ctx, x0, x1 } = f
  ctx.textAlign = "right"
  ctx.textBaseline = "middle"
  for (const t of ticks) {
    ctx.strokeStyle = grid
    ctx.beginPath()
    ctx.moveTo(x0, t.y)
    ctx.lineTo(x1, t.y)
    ctx.stroke()
    ctx.fillStyle = text
    ctx.fillText(t.label, x0 - 4, t.y)
  }
}

/** 세로 보조선 (옅게) + 아래 눈금 글자. label 이 없으면 선만 */
export function drawXGrid(f: PlotFrame, ticks: { x: number; label?: string }[], grid: string, text: string) {
  const { ctx, y0, y1 } = f
  ctx.textAlign = "center"
  ctx.textBaseline = "top"
  for (const t of ticks) {
    ctx.strokeStyle = grid
    ctx.globalAlpha = 0.5
    ctx.beginPath()
    ctx.moveTo(t.x, y0)
    ctx.lineTo(t.x, y1)
    ctx.stroke()
    ctx.globalAlpha = 1
    if (t.label) {
      ctx.fillStyle = text
      ctx.fillText(t.label, t.x, y1 + 3)
    }
  }
}

/** 오른쪽 끝 현재 시각 · step 커서 */
export function drawCursor(f: PlotFrame, color: string) {
  const { ctx, x1, y0, y1 } = f
  ctx.strokeStyle = color
  ctx.globalAlpha = 0.35
  ctx.beginPath()
  ctx.moveTo(x1, y0 - 4)
  ctx.lineTo(x1, y1)
  ctx.stroke()
  ctx.globalAlpha = 1
}

/** 실선(1.5) / 점선(1.25, 4·3) 꺾은선. NaN 은 끊어서 그린다 */
export function drawLine(f: PlotFrame, points: Iterable<[number, number]>, color: string, { dashed = false, alpha = 1 } = {}) {
  const { ctx } = f
  ctx.strokeStyle = color
  ctx.globalAlpha = alpha
  ctx.lineWidth = dashed ? 1.25 : 1.5
  ctx.setLineDash(dashed ? [4, 3] : [])
  ctx.beginPath()
  let pen = false
  for (const [x, y] of points) {
    if (Number.isNaN(y)) {
      pen = false
      continue
    }
    if (pen) ctx.lineTo(x, y)
    else ctx.moveTo(x, y)
    pen = true
  }
  ctx.stroke()
  ctx.setLineDash([])
  ctx.globalAlpha = 1
  ctx.lineWidth = 1
}

/** 오른쪽 위 범례 + 최신 값. entries 는 오른쪽부터 왼쪽으로 놓인다 */
export function drawLegend(f: PlotFrame, entries: { label: string; color: string }[], text: string) {
  const { ctx } = f
  ctx.textBaseline = "middle"
  ctx.textAlign = "right"
  let x = f.x1
  const y = PLOT_PAD.top / 2
  for (const e of entries) {
    ctx.fillStyle = text
    ctx.fillText(e.label, x, y)
    const tw = ctx.measureText(e.label).width
    ctx.fillStyle = e.color
    ctx.fillRect(x - tw - 10, y - 3, 6, 6)
    x -= tw + 20
  }
}

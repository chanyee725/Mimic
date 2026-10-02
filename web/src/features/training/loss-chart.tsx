import { LOSS_CURVE, type LossPoint } from "@/dummy/training"
import { cn } from "@/lib/utils"

const W = 600
const H = 180

/** train(실선) / val(점선) loss 곡선. 높이는 className 으로 조절한다. */
export function LossChart({ className, curve = LOSS_CURVE, legend = true }: { className?: string; curve?: LossPoint[]; legend?: boolean }) {
  const maxStep = curve[curve.length - 1].step || 1
  const maxLoss = Math.max(...curve.map((p) => Math.max(p.train, p.val)))
  const x = (step: number) => (step / maxStep) * W
  const y = (v: number) => H - 8 - (v / maxLoss) * (H - 16)
  const line = (key: "train" | "val") => curve.map((p) => `${x(p.step).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ")

  return (
    <div className={cn("flex min-h-0 flex-col gap-2.5", className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block min-h-0 w-full flex-1"
        role="img"
        aria-label="Training loss curve"
      >
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} className="stroke-border" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        <polyline points={line("train")} fill="none" className="stroke-series-1" strokeWidth={1.75} vectorEffect="non-scaling-stroke" />
        <polyline
          points={line("val")}
          fill="none"
          className="stroke-series-3"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {legend && (
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-0.75 w-2.5 bg-series-1" />
            train loss
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.75 w-2.5 bg-series-3" />
            val loss
          </span>
        </div>
      )}
    </div>
  )
}

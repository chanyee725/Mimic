import type { TaskStatus } from "@/dummy/tasks"
import { cn } from "@/lib/utils"

const RING_CLASS: Record<TaskStatus, string> = {
  active: "stroke-foreground",
  completed: "stroke-ok",
  draft: "stroke-muted-foreground/40",
}

/** Circular progress (same look as the Dashboard task list) */
export function ProgressRing({
  pct,
  status,
  label,
  thin = false,
  radius,
  className,
  labelClassName,
}: {
  pct: number
  status: TaskStatus
  label: string
  /** Thin ring for lists */
  thin?: boolean
  /** Ring radius in the 56-unit viewBox. Defaults to nearly touching the edge */
  radius?: number
  className?: string
  /** Extra classes for the centre % label */
  labelClassName?: string
}) {
  const stroke = thin ? 3.5 : 5
  const r = radius ?? 28 - stroke / 2 - 1
  const c = 2 * Math.PI * r
  return (
    <div
      className={cn("relative size-14 shrink-0", className)}
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg viewBox="0 0 56 56" className="size-full -rotate-90">
        <circle cx={28} cy={28} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
        <circle
          cx={28}
          cy={28}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          className={RING_CLASS[status]}
        />
      </svg>
      <span
        className={cn(
          "absolute inset-0 grid place-items-center tracking-tight tabular-nums",
          thin ? "text-[10px] font-normal text-muted-foreground" : "text-[11px] font-medium",
          labelClassName,
        )}
      >
        {pct}%
      </span>
    </div>
  )
}

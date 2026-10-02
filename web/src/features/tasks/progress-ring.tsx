import type { TaskStatus } from "@/dummy/tasks"
import { cn } from "@/lib/utils"

const RING_CLASS: Record<TaskStatus, string> = {
  active: "stroke-foreground",
  completed: "stroke-ok",
  draft: "stroke-muted-foreground/40",
}

/** 원형 진행도 (Dashboard Tasks 리스트와 동일한 모양) */
export function ProgressRing({
  pct,
  status,
  label,
  className,
}: {
  pct: number
  status: TaskStatus
  label: string
  className?: string
}) {
  const r = 22
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
        <circle cx={28} cy={28} r={r} fill="none" strokeWidth={5} className="stroke-muted" />
        <circle
          cx={28}
          cy={28}
          r={r}
          fill="none"
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          className={RING_CLASS[status]}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[11px] font-medium tracking-tight tabular-nums">{pct}%</span>
    </div>
  )
}

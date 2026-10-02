import { cn } from "@/lib/utils"

const TONE = {
  info: "bg-info",
  ok: "bg-ok",
  bad: "bg-bad",
  foreground: "bg-foreground",
  muted: "bg-muted-foreground/40",
} as const

/** Thin progress bar. value is 0–100 */
export function ProgressBar({
  value,
  label,
  tone = "info",
  size = "sm",
  className,
}: {
  value: number
  label: string
  tone?: keyof typeof TONE
  size?: "xs" | "sm"
  className?: string
}) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div
      className={cn("overflow-hidden rounded-full bg-muted", size === "xs" ? "h-1" : "h-1.5", className)}
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={cn("h-full rounded-full", TONE[tone])} style={{ width: `${v}%` }} />
    </div>
  )
}

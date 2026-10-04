import { cn } from "@/lib/utils"

export type Tone = "ok" | "warn" | "bad" | "info" | "muted"

const DOT: Record<Tone, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  bad: "bg-bad",
  info: "bg-info",
  muted: "bg-muted-foreground/60",
}

/** Status is always a dot plus text, never a coloured pill. */
export function StatusDot({ tone, children, className }: { tone: Tone; children?: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", DOT[tone])} />
      {children}
    </span>
  )
}

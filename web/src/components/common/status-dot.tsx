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
    // The dot sits on the first line when the text wraps
    <span className={cn("inline-flex items-start gap-1.5 text-sm", className)}>
      <span aria-hidden className="flex h-lh shrink-0 items-center">
        <span className={cn("size-1.5 rounded-full", DOT[tone])} />
      </span>
      {children}
    </span>
  )
}

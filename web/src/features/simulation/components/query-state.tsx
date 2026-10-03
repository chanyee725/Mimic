import { LuRotateCw } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Muted placeholder shown inside a panel while its query loads */
export function Loading({ className, children = "Loading…" }: { className?: string; children?: React.ReactNode }) {
  return <p className={cn("grid flex-1 place-items-center py-8 text-[13px] text-muted-foreground", className)}>{children}</p>
}

/** Error message of a failed query or action, with an optional Retry */
export function ErrorNote({ error, onRetry, className }: { error: Error | null; onRetry?: () => void; className?: string }) {
  if (!error) return null
  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-md bg-bad-muted px-3 py-2 text-[13px] text-bad", className)}>
      <span className="min-w-0 break-words">{error.message}</span>
      {onRetry && (
        <Button variant="outline" size="xs" className="shrink-0" onClick={() => onRetry()}>
          <LuRotateCw />
          Retry
        </Button>
      )}
    </div>
  )
}

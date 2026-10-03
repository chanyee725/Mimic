import { LuRotateCw } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Muted placeholder shown inside a panel while its query loads */
export function Loading({ className }: { className?: string }) {
  return <p className={cn("grid flex-1 place-items-center py-10 text-[13px] text-muted-foreground", className)}>Loading…</p>
}

/** Small red note with the server's message; Retry refetches when given */
export function ErrorNote({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  if (!error) return null
  const message = error instanceof Error ? error.message : String(error)
  return (
    <div className={cn("flex items-center gap-2 rounded-md bg-bad-muted px-3 py-2 text-xs text-bad", className)} role="alert">
      <span className="min-w-0 flex-1">{message}</span>
      {onRetry && (
        <Button variant="ghost" size="xs" className="text-bad hover:text-bad" onClick={onRetry}>
          <LuRotateCw />
          Retry
        </Button>
      )}
    </div>
  )
}

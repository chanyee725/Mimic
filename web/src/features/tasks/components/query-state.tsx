import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Muted placeholder shown inside a panel while its query loads */
export function Loading({ className }: { className?: string }) {
  return <p className={cn("py-6 text-center text-[13px] text-muted-foreground", className)}>Loading…</p>
}

/** Small red note with the server's message and a Retry button */
export function QueryError({ error, onRetry, className }: { error: Error | null; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-md bg-bad-muted px-3 py-2 text-[13px] text-bad", className)}>
      <span className="min-w-0 break-words">{error?.message ?? "Request failed"}</span>
      {onRetry && (
        <Button variant="outline" size="xs" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}

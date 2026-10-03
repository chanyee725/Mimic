import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type QueryLike = { isPending: boolean; error: Error | null; refetch: () => unknown }

/** Muted "Loading…" while a query loads, the error with Retry when it failed, nothing once it has data */
export function QueryNote({ query, className }: { query: QueryLike; className?: string }) {
  if (query.error) return <ErrorNote error={query.error} onRetry={() => void query.refetch()} className={className} />
  if (query.isPending) return <p className={cn("text-[13px] text-muted-foreground", className)}>Loading…</p>
  return null
}

/** Small red error line, with Retry for failed queries */
export function ErrorNote({ error, onRetry, className }: { error: Error | null; onRetry?: () => void; className?: string }) {
  if (!error) return null
  return (
    <div role="alert" className={cn("flex items-center justify-between gap-2 text-xs text-bad", className)}>
      <span className="min-w-0">{error.message}</span>
      {onRetry && (
        <Button variant="outline" size="sm" className="h-7 shrink-0" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}

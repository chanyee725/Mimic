import type { UseQueryResult } from "@tanstack/react-query"
import { LuRotateCw } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Muted "Loading…" line shown inside a panel while its query loads */
export function LoadingNote({ className, children = "Loading…" }: { className?: string; children?: React.ReactNode }) {
  return (
    <p role="status" className={cn("animate-pulse text-[13px] text-muted-foreground", className)}>
      {children}
    </p>
  )
}

/** Small red note with the server's error message and a Retry button */
export function ErrorNote({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  if (!error) return null
  const message = error instanceof Error ? error.message : String(error)
  return (
    <div role="alert" className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-bad", className)}>
      <span className="min-w-0">{message || "Request failed"}</span>
      {onRetry && (
        <Button variant="outline" size="xs" onClick={onRetry}>
          <LuRotateCw />
          Retry
        </Button>
      )}
    </div>
  )
}

type QueryLike = { isPending: boolean; error: Error | null; refetch: () => unknown }

/** Loading note while a query loads, the error with Retry when it failed, nothing once it has data */
export function QueryNote({ query, className }: { query: QueryLike; className?: string }) {
  if (query.error) return <ErrorNote error={query.error} onRetry={() => void query.refetch()} className={className} />
  if (query.isPending) return <LoadingNote className={className} />
  return null
}

/** Renders the loading note or the error note for a query, and children(data) once it has data */
export function QueryView<T>({
  query,
  loading,
  className,
  children,
}: {
  query: UseQueryResult<T, Error>
  /** Replaces the default loading note (e.g. a skeleton the size of the content) */
  loading?: React.ReactNode
  className?: string
  children: (data: T) => React.ReactNode
}) {
  if (query.data !== undefined) return children(query.data)
  if (query.isError) return <ErrorNote error={query.error} onRetry={() => void query.refetch()} className={className} />
  return loading ?? <LoadingNote className={className} />
}

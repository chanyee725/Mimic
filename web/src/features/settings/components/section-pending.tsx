import { ErrorNote, LoadingNote } from "@/components/common/query-state"

/** Placeholder for a whole settings section while its query loads or after it failed */
export function SectionPending({ query }: { query: { isError: boolean; error: Error | null; refetch: () => unknown } }) {
  return (
    <div className="rounded-lg border p-5">
      {query.isError ? <ErrorNote error={query.error} onRetry={() => void query.refetch()} /> : <LoadingNote />}
    </div>
  )
}

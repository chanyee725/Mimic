import { Button } from "@/components/ui/button"

/** Shown below the section while there are unsaved changes, or when the last save failed */
export function SaveBar({
  dirty,
  pending,
  error,
  onSave,
  onReset,
}: {
  dirty: boolean
  pending: boolean
  error: string | null
  onSave: () => void
  onReset: () => void
}) {
  if (!dirty && !error) return null
  return (
    <div className="flex items-center justify-between gap-3 border-t bg-muted/40 px-5 py-3">
      {error ? (
        <span className="min-w-0 text-xs whitespace-pre-line text-bad">{error}</span>
      ) : (
        <span className="text-xs text-muted-foreground">저장하지 않은 변경 사항이 있습니다.</span>
      )}
      {dirty && (
        <div className="flex shrink-0 gap-2">
          <Button variant="ghost" size="sm" disabled={pending} onClick={onReset}>
            Discard
          </Button>
          <Button size="sm" disabled={pending} onClick={onSave}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      )}
    </div>
  )
}

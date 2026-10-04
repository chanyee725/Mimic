import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useDraftOnOpen } from "@/hooks/use-draft-on-open"

import { TASK_ID_RE } from "../lib"
import { Field } from "./field"

/** Asks for a task id and name (New task, Duplicate) and shows the server's error under the fields */
export function TaskIdDialog({
  open,
  onOpenChange,
  title,
  description,
  initial,
  submitLabel,
  pending,
  error,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  initial: { id: string; name: string }
  submitLabel: string
  pending: boolean
  error: string | null
  onSubmit: (value: { id: string; name: string }) => void
}) {
  const [draft, setDraft] = useDraftOnOpen(open, initial)
  const idOk = TASK_ID_RE.test(draft.id)
  const canSubmit = idOk && draft.name.trim() !== "" && !pending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (canSubmit) onSubmit({ id: draft.id, name: draft.name.trim() })
          }}
        >
          <Field label="Task ID" htmlFor="d-id">
            <Input
              id="d-id"
              className="h-9 font-mono text-[13px]"
              value={draft.id}
              aria-invalid={draft.id !== "" && !idOk}
              onChange={(e) => setDraft((d) => ({ ...d, id: e.target.value }))}
            />
            <span className="text-xs text-muted-foreground">소문자, 숫자, - 만 쓸 수 있고 만든 뒤에는 바꿀 수 없습니다.</span>
          </Field>
          <Field label="Task name" htmlFor="d-name">
            <Input id="d-name" className="h-9" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
          </Field>
          {error && <p className="text-[13px] whitespace-pre-line text-bad">{error}</p>}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
            <Button type="submit" disabled={!canSubmit}>
              {pending ? "Saving…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

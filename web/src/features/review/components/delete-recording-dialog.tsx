import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

import { ErrorNote } from "./query-note"

/** Confirm MCAP deletion */
export function DeleteRecordingDialog({
  open,
  onOpenChange,
  file,
  pending,
  error,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  file?: string
  pending: boolean
  error: Error | null
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete recording?</DialogTitle>
          <DialogDescription>{file} 파일을 삭제합니다. 삭제한 MCAP 은 되돌릴 수 없습니다.</DialogDescription>
        </DialogHeader>
        <ErrorNote error={error} />
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button className="bg-destructive text-white hover:bg-destructive/90" disabled={pending} onClick={onConfirm}>
            {pending ? "Deleting…" : "Delete recording"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

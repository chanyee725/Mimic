import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { plural } from "@/lib/format"

import { ErrorNote } from "@/components/common/query-state"

/** Confirm MCAP deletion: one file, or `count` checked episodes */
export function DeleteRecordingDialog({
  open,
  onOpenChange,
  file,
  count,
  pending,
  error,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  file?: string
  count?: number
  pending: boolean
  error: Error | null
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{count ? `Delete ${plural(count, "recording")}?` : "Delete recording?"}</DialogTitle>
          <DialogDescription>
            {count ? `선택한 에피소드 ${count.toLocaleString()}개를 삭제합니다.` : `${file} 파일을 삭제합니다.`} 삭제한 MCAP 은 되돌릴 수
            없습니다.
          </DialogDescription>
        </DialogHeader>
        <ErrorNote error={error} />
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button className="bg-destructive text-white hover:bg-destructive/90" disabled={pending} onClick={onConfirm}>
            {pending ? "Deleting…" : count ? `Delete ${plural(count, "recording")}` : "Delete recording"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

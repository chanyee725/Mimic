import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

/** Confirm MCAP deletion */
export function DeleteRecordingDialog({
  open,
  onOpenChange,
  file,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  file?: string
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete recording?</DialogTitle>
          <DialogDescription>{file} 파일을 삭제합니다. 삭제한 MCAP 은 되돌릴 수 없습니다.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button className="bg-destructive text-white hover:bg-destructive/90" onClick={onConfirm}>
            Delete recording
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

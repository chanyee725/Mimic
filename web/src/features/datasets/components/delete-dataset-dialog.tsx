import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

import { ErrorNote } from "./query-note"

/** Confirm dataset deletion (also cancels a running conversion) */
export function DeleteDatasetDialog({
  open,
  onOpenChange,
  repoId,
  converting,
  pending,
  error,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  repoId: string
  converting: boolean
  pending: boolean
  error: Error | null
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete dataset?</DialogTitle>
          <DialogDescription>
            {repoId} 데이터셋을 로컬에서 삭제합니다.{converting && " 진행 중인 변환도 취소됩니다."} 원본 MCAP 과 HF Hub 에 올린 사본은
            그대로 남습니다.
          </DialogDescription>
        </DialogHeader>
        <ErrorNote error={error} />
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button className="bg-destructive text-white hover:bg-destructive/90" disabled={pending} onClick={onConfirm}>
            {pending ? "Deleting…" : "Delete dataset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

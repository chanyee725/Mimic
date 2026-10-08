import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ErrorNote } from "@/components/common/query-state"

/** Confirm task deletion; the server refuses (409) while the task has recordings */
export function DeleteTaskDialog({
  open,
  onOpenChange,
  taskId,
  pending,
  error,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskId: string
  pending: boolean
  error: Error | null
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete task?</DialogTitle>
          <DialogDescription>
            {taskId} Task 파일을 삭제합니다. 녹화가 있는 Task 는 지울 수 없으니, Review 에서 에피소드를 먼저 지우세요.
          </DialogDescription>
        </DialogHeader>
        <ErrorNote error={error} />
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button className="bg-destructive text-white hover:bg-destructive/90" disabled={pending} onClick={onConfirm}>
            {pending ? "Deleting…" : "Delete task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

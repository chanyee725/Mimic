import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ErrorNote } from "@/components/common/query-state"
import { usePullDataset } from "@/api/datasets"

/** Download a LeRobot v3.0 dataset repo from the HF Hub under the same repoId */
export function PullDatasetDialog({
  open,
  onOpenChange,
  onPulled,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPulled: (repoId: string) => void
}) {
  const [repoId, setRepoId] = useState("")
  const pull = usePullDataset()
  const id = repoId.trim()

  const change = (next: boolean) => {
    if (!next) {
      setRepoId("")
      pull.reset()
    }
    onOpenChange(next)
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || pull.isPending) return
    pull.mutate(id, {
      onSuccess: (d) => {
        change(false)
        onPulled(d.repoId)
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Pull from Hugging Face Hub</DialogTitle>
            <DialogDescription>
              HF Hub 의 LeRobot v3.0 데이터셋을 같은 이름으로 내려받습니다. 비공개 저장소는 Settings 의 Hugging Face 토큰이 필요합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="pull-repo" className="text-xs font-normal text-muted-foreground">
              Repository
            </Label>
            <Input
              id="pull-repo"
              autoFocus
              className="h-9 text-[13px]"
              value={repoId}
              placeholder="namespace/dataset_name"
              onChange={(e) => setRepoId(e.target.value)}
            />
          </div>
          <ErrorNote error={pull.error} />
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={!id || pull.isPending}>
              {pull.isPending ? "Checking…" : "Pull dataset"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

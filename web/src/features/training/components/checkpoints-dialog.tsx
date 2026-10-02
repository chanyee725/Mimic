import { useState } from "react"
import { LuBox, LuCloudUpload, LuDownload, LuSave } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { Checkpoint, TrainJob } from "@/domain/training"

import type { JobRun } from "../lib"

/** All checkpoints of a job. Pick some to download or push to the HF Hub */
export function CheckpointsDialog({
  job,
  run,
  checkpoints,
  open,
  onOpenChange,
}: {
  job: TrainJob
  run: JobRun
  checkpoints: Checkpoint[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [picked, setPicked] = useState<number[]>([])
  const rows = [...checkpoints].reverse()
  // Smoothed loss at that step (to help pick one)
  const lossAt = (step: number) => run.data.loss[Math.min(step, run.count) - 1]
  const best = rows.reduce<Checkpoint | undefined>((b, c) => (!b || lossAt(c.step) < lossAt(b.step) ? c : b), undefined)
  const toggle = (step: number, on: boolean) => setPicked((p) => (on ? [...p, step] : p.filter((s) => s !== step)))
  const sizeGB = rows.filter((c) => picked.includes(c.step)).reduce((a, c) => a + c.sizeMB / 1024, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[85svh] grid-rows-[auto_minmax(0,1fr)_auto] gap-3 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Checkpoints</DialogTitle>
          <DialogDescription>
            {job.id}, {job.dataset}. 남길 checkpoint 를 골라 Models 에 저장하거나 내려받거나 HF Hub 에 올립니다.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto rounded-md border">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="w-10 px-3 py-2 font-normal">
                  <Checkbox
                    aria-label="Select all"
                    checked={picked.length === rows.length && rows.length > 0}
                    onCheckedChange={(v) => setPicked(v === true ? rows.map((c) => c.step) : [])}
                  />
                </th>
                <th className="px-3 py-2 font-normal">Step</th>
                <th className="px-3 py-2 font-normal">Saved</th>
                <th className="px-3 py-2 text-right font-normal">Loss</th>
                <th className="px-3 py-2 text-right font-normal">Size</th>
                <th className="w-20 px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((c) => (
                <tr key={c.step}>
                  <td className="px-3 py-1.5">
                    <Checkbox
                      aria-label={`Select step ${c.step}`}
                      checked={picked.includes(c.step)}
                      onCheckedChange={(v) => toggle(c.step, v === true)}
                    />
                  </td>
                  <td className="px-3 py-1.5 tabular-nums">
                    {c.step.toLocaleString()}
                    {c === best && rows.length > 1 && <span className="ml-2 text-xs text-ok">lowest loss</span>}
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground tabular-nums">{c.savedAt}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{lossAt(c.step).toFixed(3)}</td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground tabular-nums">{(c.sizeMB / 1024).toFixed(1)} GB</td>
                  <td className="px-2 py-1 text-right whitespace-nowrap">
                    <Button variant="ghost" size="icon-sm" aria-label={`Download step ${c.step}`} title="Download">
                      <LuDownload />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Evaluate step ${c.step} in Sim`} title="Evaluate in Sim">
                      <LuBox />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <span className="text-xs text-muted-foreground tabular-nums">
            {picked.length ? `${picked.length} selected, ${sizeGB.toFixed(1)} GB` : "Select checkpoints to save"}
          </span>
          <div className="flex gap-2">
            <DialogClose render={<Button variant="ghost" />}>Close</DialogClose>
            <Button variant="outline" disabled={!picked.length}>
              <LuCloudUpload />
              Push to HF Hub
            </Button>
            <Button variant="outline" disabled={!picked.length}>
              <LuDownload />
              Download
            </Button>
            <Button disabled={!picked.length}>
              <LuSave />
              Save to Models
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

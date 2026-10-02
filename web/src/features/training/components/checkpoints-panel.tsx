import { useState } from "react"
import { LuBox, LuDownload } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Panel } from "@/components/app/page"
import type { Checkpoint, TrainJob } from "@/dummy/training"

import type { JobRun } from "../lib"
import { CheckpointsDialog } from "./checkpoints-dialog"

/** Job 상세 옆의 checkpoint 목록. View all 로 전체 모달을 연다 */
export function CheckpointsPanel({ job, run, checkpoints }: { job: TrainJob; run: JobRun; checkpoints: Checkpoint[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Panel
        title="Checkpoints"
        className="shrink-0"
        action={
          <span className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
            {checkpoints.length}
            {checkpoints.length > 0 && (
              <button type="button" className="text-foreground hover:underline" onClick={() => setOpen(true)}>
                View all
              </button>
            )}
          </span>
        }
      >
        {checkpoints.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted-foreground">
            {job.status === "running" ? "첫 checkpoint 는 5,000 step 에서 저장됩니다." : "저장된 checkpoint 가 없습니다."}
          </p>
        ) : (
          <ul className="-mx-2 max-h-64 divide-y overflow-y-auto">
            {[...checkpoints].reverse().map((c) => (
              <li key={c.step} className="flex items-center gap-2 px-2 py-2">
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="text-[13px] tabular-nums">Step {c.step.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {c.savedAt}, {(c.sizeMB / 1024).toFixed(1)} GB
                  </span>
                </span>
                <Button variant="ghost" size="icon-sm" aria-label={`Download step ${c.step}`} title="Download">
                  <LuDownload />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Evaluate step ${c.step} in Sim`} title="Evaluate in Sim">
                  <LuBox />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <CheckpointsDialog job={job} run={run} checkpoints={checkpoints} open={open} onOpenChange={setOpen} />
    </>
  )
}

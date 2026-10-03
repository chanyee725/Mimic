import { useState } from "react"
import { LuBox, LuDownload } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Panel } from "@/components/layout/page-layout"
import type { TrainJob } from "@/domain/training"
import { formatDateTime } from "@/lib/format"

import { useCheckpointActions } from "../hooks/use-checkpoint-actions"
import type { JobRun } from "../lib"
import { CheckpointsDialog } from "./checkpoints-dialog"
import { ErrorNote } from "./query-state"

/** Checkpoint list beside the job detail. View all opens the full dialog */
export function CheckpointsPanel({ job, run }: { job: TrainJob; run: JobRun }) {
  const [open, setOpen] = useState(false)
  const actions = useCheckpointActions(job)
  const checkpoints = job.checkpoints
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
            {job.status === "running" ? "첫 checkpoint 는 save_freq step 마다 저장됩니다." : "저장된 checkpoint 가 없습니다."}
          </p>
        ) : (
          <ul className="-mx-2 max-h-64 divide-y overflow-y-auto">
            {[...checkpoints].reverse().map((c) => (
              <li key={c.step} className="flex items-center gap-2 px-2 py-2">
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="text-[13px] tabular-nums">Step {c.step.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatDateTime(c.savedAt)}, {(c.sizeMB / 1024).toFixed(1)} GB
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Download step ${c.step}`}
                  title="Download"
                  disabled={!!actions.pending}
                  onClick={() => actions.run("download", [c.step])}
                >
                  <LuDownload />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Evaluate step ${c.step} in Sim`} title="Evaluate in Sim">
                  <LuBox />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <ErrorNote error={actions.error} />
      </Panel>
      <CheckpointsDialog job={job} run={run} open={open} onOpenChange={setOpen} />
    </>
  )
}

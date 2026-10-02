import { Link } from "react-router-dom"
import { LuChevronRight, LuCloud, LuServer } from "react-icons/lu"

import { ProgressBar } from "@/components/common/progress-bar"
import { StatusDot } from "@/components/common/status-dot"
import type { TrainJob } from "@/dummy/training"
import { formatRate } from "@/lib/format"

import { JOB_STATUS, computeText, jobPct } from "../lib"

/** One row in the job list. Links to the job detail page */
export function JobRow({ job }: { job: TrainJob }) {
  const pct = jobPct(job)
  const status = JOB_STATUS[job.status]
  return (
    <li>
      <Link
        to={`/training/${job.id}`}
        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2.5 rounded-md px-3 py-3 transition-colors hover:bg-accent/60"
      >
        <div className="grid min-w-0 gap-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium">{job.taskId}</span>
            <StatusDot tone={status.tone} className="shrink-0 text-xs text-muted-foreground">
              {status.label}
            </StatusDot>
          </div>
          <span className="truncate text-xs text-muted-foreground">
            {job.id}, {job.dataset}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-lg font-medium tabular-nums">
            {pct}
            <span className="text-xs text-muted-foreground">%</span>
          </span>
          <LuChevronRight className="size-4 text-muted-foreground" aria-hidden />
        </div>

        <ProgressBar
          value={pct}
          label={`${job.id} progress`}
          tone={job.status === "running" ? "info" : "muted"}
          size="xs"
          className="col-span-2"
        />

        <div className="col-span-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground tabular-nums">
          <span className="inline-flex items-center gap-1.5 text-foreground">
            {job.compute === "local" ? <LuServer className="size-3.5" aria-hidden /> : <LuCloud className="size-3.5" aria-hidden />}
            {computeText(job)}
          </span>
          <span>
            Step {job.step.toLocaleString()} / {job.total.toLocaleString()}
          </span>
          {job.elapsed && <span>Elapsed {job.elapsed}</span>}
          {job.eta && <span>ETA {job.eta}</span>}
          {job.status === "queued" && <span>Waiting for a GPU</span>}
          {job.podState?.state === "idle" && <span className="text-warn">Pod still running, {formatRate(job.pricePerHr ?? 0)}</span>}
        </div>
      </Link>
    </li>
  )
}

import { Link } from "react-router-dom"
import { LuChevronRight } from "react-icons/lu"

import { ProgressBar } from "@/components/common/progress-bar"
import { StatusDot } from "@/components/common/status-dot"
import { simSuccessRate, type SimJob } from "@/domain/simulation"
import { formatDuration, formatPct } from "@/lib/format"

import { RANDOMIZATION, SIM_STATUS, simPct } from "../lib"

/** One row in the evaluation list. Links to the evaluation detail page */
export function SimJobRow({ job, modelName, envName }: { job: SimJob; modelName?: string; envName?: string }) {
  const done = job.done
  const pct = simPct(done, job.episodes)
  const status = SIM_STATUS[job.status]
  const rand = RANDOMIZATION.find((r) => r.value === job.randomization)
  return (
    <li>
      <Link
        to={`/evaluate/sim/${job.id}`}
        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2.5 rounded-md px-3 py-3 transition-colors hover:bg-accent/60"
      >
        <div className="grid min-w-0 gap-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium">{modelName ?? job.modelId}</span>
            <StatusDot tone={status.tone} className="shrink-0 text-xs text-muted-foreground">
              {status.label}
            </StatusDot>
          </div>
          <span className="truncate text-xs text-muted-foreground">
            {job.id}, {envName ?? job.envId}
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
          <span className="text-foreground">
            Episode {done} / {job.episodes}
          </span>
          <span>Success {formatPct(simSuccessRate(job))}</span>
          <span>Randomization {rand?.label ?? job.randomization}</span>
          {job.elapsedS != null && <span>Elapsed {formatDuration(job.elapsedS)}</span>}
          {job.status === "running" && job.etaS != null && <span>ETA {formatDuration(job.etaS)}</span>}
          {job.status === "queued" && <span>Waiting for the GPU</span>}
          {job.status === "failed" && (
            <span className="max-w-full truncate text-bad" title={job.error}>
              {job.error ?? status.label}
            </span>
          )}
        </div>
      </Link>
    </li>
  )
}

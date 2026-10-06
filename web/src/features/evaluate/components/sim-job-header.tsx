import { LuArrowLeft, LuSquare } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { LinkButton } from "@/components/common/link-button"
import { StatusDot } from "@/components/common/status-dot"
import { useStopSimJob } from "@/api/simulation"
import type { SimJob } from "@/domain/simulation"

import { SIM_STATUS } from "../lib"

/** Back button, model name and job status */
export function SimJobTitle({ job, modelName }: { job: SimJob; modelName: string }) {
  const status = SIM_STATUS[job.status]
  return (
    <span className="flex min-w-0 items-center gap-3">
      <LinkButton
        to="/evaluate?target=sim"
        variant="ghost"
        size="icon-sm"
        className="-ml-1.5"
        aria-label="Back to Evaluate"
        title="Back to Evaluate"
      >
        <LuArrowLeft />
      </LinkButton>
      <span className="truncate">{modelName}</span>
      <StatusDot tone={status.tone} className="text-sm font-normal text-muted-foreground">
        {status.label}
      </StatusDot>
    </span>
  )
}

/** Stop (running) or Cancel (queued) */
export function SimJobActions({ job }: { job: SimJob }) {
  const stop = useStopSimJob()
  if (job.status !== "running" && job.status !== "queued") return null
  return (
    <span className="flex items-center gap-2">
      {stop.error && (
        <span className="max-w-72 truncate text-xs text-bad" title={stop.error.message}>
          {stop.error.message}
        </span>
      )}
      <Button variant="outline" size="sm" className="text-bad hover:text-bad" disabled={stop.isPending} onClick={() => stop.mutate(job.id)}>
        <LuSquare />
        {stop.isPending ? "Stopping…" : job.status === "running" ? "Stop evaluation" : "Cancel"}
      </Button>
    </span>
  )
}

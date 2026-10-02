import { useState } from "react"
import { Navigate, useParams } from "react-router-dom"
import { LuArrowLeft, LuClock, LuDollarSign, LuFootprints, LuHourglass, LuSquare } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { LinkButton } from "@/components/common/link-button"
import { Page, Panel } from "@/components/layout/page-layout"
import { StatStrip } from "@/components/common/stat-strip"
import { StatusDot } from "@/components/common/status-dot"
import { getJob, type TrainJob } from "@/dummy/training"
import { formatDuration, formatRate, formatUsd } from "@/lib/format"

import { CheckpointsPanel } from "./components/checkpoints-panel"
import { JobConfig } from "./components/job-config"
import { MetricPlots } from "./components/metric-plots"
import { PodBar } from "./components/pod-bar"
import { useJobRun } from "./hooks/use-job-run"
import { JOB_STATUS, METRICS, checkpointsAt, computeText } from "./lib"

export function JobPage() {
  const { jobId = "" } = useParams()
  const job = getJob(jobId)
  if (!job) return <Navigate to="/training" replace />
  return <JobView key={job.id} job={job} />
}

function JobView({ job }: { job: TrainJob }) {
  const { run, step, live, stepsPerSec, elapsedSec, remainingSec } = useJobRun(job)
  const status = JOB_STATUS[job.status]
  const pct = Math.round((step / job.total) * 100)
  const cost = job.pricePerHr ? (job.pricePerHr * elapsedSec) / 3600 : undefined
  const checkpoints = checkpointsAt(job, step)
  const [pod, setPod] = useState(job.podState)

  return (
    <Page
      fit
      title={
        <span className="flex min-w-0 items-center gap-3">
          <LinkButton
            to="/training"
            variant="ghost"
            size="icon-sm"
            className="-ml-1.5"
            aria-label="Back to training"
            title="Back to training"
          >
            <LuArrowLeft />
          </LinkButton>
          <span className="truncate">{job.taskId}</span>
          <StatusDot tone={status.tone} className="text-sm font-normal text-muted-foreground">
            {status.label}
          </StatusDot>
        </span>
      }
      description={`${job.id}, ${job.dataset}, ${computeText(job)}`}
      actions={
        (job.status === "running" || job.status === "queued") && (
          <Button variant="outline" size="sm" className="text-bad hover:text-bad">
            <LuSquare />
            {job.status === "running" ? "Stop training" : "Cancel"}
          </Button>
        )
      }
    >
      {job.compute === "runpod" && (
        <PodBar job={job} pod={pod} onTerminate={() => setPod((p) => p && { ...p, state: "terminated", since: "just now" })} />
      )}
      {job.error && <div className="rounded-md bg-bad-muted px-3 py-2.5 text-[13px] text-bad">{job.error}</div>}

      <StatStrip
        items={[
          {
            label: "Progress",
            value: `${pct}%`,
            sub: `${step.toLocaleString()} / ${job.total.toLocaleString()} steps`,
            icon: LuFootprints,
          },
          { label: "Elapsed", value: elapsedSec ? formatDuration(elapsedSec) : "—", icon: LuClock },
          {
            label: "ETA",
            value: live ? formatDuration(remainingSec) : "—",
            sub: live ? `${stepsPerSec.toFixed(2)} steps/s` : undefined,
            icon: LuHourglass,
          },
          job.compute === "runpod"
            ? {
                label: live ? "Cost so far" : "Cost",
                value: formatUsd(cost ?? 0),
                sub: formatRate(job.pricePerHr ?? 0),
                icon: LuDollarSign,
              }
            : { label: "Cost", value: "Local", sub: "no rental fee", icon: LuDollarSign },
        ]}
      />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Panel
          title="Metrics"
          className="min-h-0"
          action={
            <span className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
              {live && (
                <StatusDot tone="info" className="text-xs">
                  Live
                </StatusDot>
              )}
              Logged every step, step {step.toLocaleString()}
            </span>
          }
        >
          {step > 1 ? (
            <MetricPlots run={run} metrics={METRICS} live={live} className="flex-1" />
          ) : (
            <p className="grid flex-1 place-items-center py-10 text-[13px] text-muted-foreground">아직 학습이 시작되지 않았습니다.</p>
          )}
        </Panel>

        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          <CheckpointsPanel job={job} run={run} checkpoints={checkpoints} />
          <Panel title="Config" className="shrink-0">
            <JobConfig job={job} />
          </Panel>
        </div>
      </div>
    </Page>
  )
}

import { Link, Navigate, useParams } from "react-router-dom"
import { LuArrowLeft, LuBox, LuClock, LuDollarSign, LuDownload, LuFootprints, LuHourglass, LuSquare } from "react-icons/lu"

import { Page, Panel } from "@/components/app/page"
import { StatStrip } from "@/components/app/stat-strip"
import { StatusDot } from "@/components/app/status-dot"
import { Button, buttonVariants } from "@/components/ui/button"
import { POLICY_BASE, getJob, lossCurve, type TrainJob } from "@/dummy/training"
import { cn } from "@/lib/utils"

import { JOB_STATUS, computeText, hoursOf, jobPct } from "./jobs"
import { LossChart } from "./loss-chart"

function JobConfig({ job }: { job: TrainJob }) {
  const rows = [
    { k: "Model", v: `${job.policy} (${POLICY_BASE})` },
    { k: "Dataset", v: job.dataset },
    { k: "Compute", v: computeText(job) },
    ...(job.pod ? [{ k: "Pod", v: job.pod }] : []),
    { k: "Steps", v: job.total.toLocaleString() },
    { k: "Batch size", v: String(job.batch) },
    { k: "Epochs", v: String(job.epochs) },
    { k: "Started", v: job.startedAt ?? "Not started" },
  ]
  return (
    <dl className="divide-y">
      {rows.map((r) => (
        <div key={r.k} className="flex justify-between gap-4 py-2 text-[13px]">
          <dt className="shrink-0 text-muted-foreground">{r.k}</dt>
          <dd className="min-w-0 truncate text-right tabular-nums">{r.v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function JobPage() {
  const { jobId = "" } = useParams()
  const job = getJob(jobId)
  if (!job) return <Navigate to="/training" replace />

  const status = JOB_STATUS[job.status]
  const pct = jobPct(job)
  const cost = job.pricePerHr ? job.pricePerHr * hoursOf(job.elapsed) : undefined

  return (
    <Page
      fit
      title={
        <span className="flex min-w-0 items-center gap-3">
          <Link
            to="/training"
            className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "-ml-1.5")}
            aria-label="Back to training"
            title="Back to training"
          >
            <LuArrowLeft />
          </Link>
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
      {job.error && <div className="rounded-md bg-bad-muted px-3 py-2.5 text-[13px] text-bad">{job.error}</div>}

      <StatStrip
        items={[
          {
            label: "Progress",
            value: `${pct}%`,
            sub: `${job.step.toLocaleString()} / ${job.total.toLocaleString()} steps`,
            icon: LuFootprints,
          },
          { label: "Elapsed", value: job.elapsed ?? "—", icon: LuClock },
          { label: "ETA", value: job.eta ?? "—", icon: LuHourglass },
          job.compute === "runpod"
            ? {
                label: "Cost so far",
                value: cost ? `$${cost.toFixed(2)}` : "$0.00",
                sub: `$${job.pricePerHr?.toFixed(2)}/h`,
                icon: LuDollarSign,
              }
            : { label: "Cost", value: "Local", sub: "no rental fee", icon: LuDollarSign },
        ]}
      />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel
          title="Loss"
          className="min-h-0"
          action={<span className="text-xs text-muted-foreground tabular-nums">step {job.step.toLocaleString()}</span>}
        >
          {job.step > 0 ? (
            <LossChart className="min-h-48 flex-1" curve={lossCurve(14, Math.floor(job.step / 1000) + 1)} />
          ) : (
            <p className="grid flex-1 place-items-center py-10 text-[13px] text-muted-foreground">아직 학습이 시작되지 않았습니다.</p>
          )}
        </Panel>

        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          <Panel
            title="Checkpoints"
            className="min-h-36 flex-1"
            action={<span className="text-xs text-muted-foreground">{job.checkpoints.length}</span>}
          >
            {job.checkpoints.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-muted-foreground">
                {job.status === "running" ? "첫 checkpoint 는 5,000 step 에서 저장됩니다." : "저장된 checkpoint 가 없습니다."}
              </p>
            ) : (
              <ul className="-mx-2 min-h-0 divide-y overflow-y-auto">
                {[...job.checkpoints].reverse().map((c) => (
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

          <Panel title="Config" className="shrink-0">
            <JobConfig job={job} />
          </Panel>
        </div>
      </div>
    </Page>
  )
}

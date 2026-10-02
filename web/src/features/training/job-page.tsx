import { useState } from "react"
import { Link, Navigate, useParams } from "react-router-dom"
import { LuArrowLeft, LuBox, LuClock, LuDollarSign, LuDownload, LuFootprints, LuHourglass, LuSquare } from "react-icons/lu"

import { Page, Panel } from "@/components/app/page"
import { StatStrip } from "@/components/app/stat-strip"
import { StatusDot } from "@/components/app/status-dot"
import { Button, buttonVariants } from "@/components/ui/button"
import { POLICY_BASE, getJob, type Checkpoint, type TrainJob } from "@/dummy/training"
import { cn } from "@/lib/utils"

import { CheckpointsDialog } from "./checkpoints-dialog"
import { formatDuration, useJobRun } from "./job-run"
import { JOB_STATUS, computeText } from "./jobs"
import { MetricPlots, type Metric } from "./metric-plots"

const SAVE_EVERY = 5000

const METRICS: Metric[] = [
  {
    title: "Loss",
    lines: [
      { key: "loss_raw", label: "raw", color: "--series-1", faint: true },
      { key: "loss", label: "loss (smoothed)", color: "--series-1" },
    ],
    format: (v) => v.toFixed(3),
    zero: true,
  },
  {
    title: "Gradient norm",
    lines: [{ key: "grad_norm", label: "grad_norm", color: "--series-2" }],
    format: (v) => v.toFixed(2),
    zero: true,
  },
  {
    title: "Learning rate",
    lines: [{ key: "lr", label: "lr", color: "--series-4" }],
    format: (v) => (v === 0 ? "0" : v.toExponential(1)),
    zero: true,
  },
  {
    title: "Step time",
    lines: [
      { key: "update_s", label: "update", color: "--series-1" },
      { key: "data_s", label: "data", color: "--series-3", dashed: true },
    ],
    format: (v) => `${Math.round(v * 1000)} ms`,
    zero: true,
  },
  {
    title: "GPU utilization",
    lines: [{ key: "gpu_util", label: "util", color: "--series-5" }],
    format: (v) => `${v.toFixed(0)}%`,
    max: 100,
    zero: true,
  },
  { title: "GPU memory", lines: [{ key: "gpu_mem", label: "used", color: "--series-6" }], format: (v) => `${v.toFixed(1)} GB`, zero: true },
]

/** 저장된 checkpoint + 학습 중 새로 지난 저장 지점 */
function checkpointsAt(job: TrainJob, step: number): Checkpoint[] {
  const saved = [...job.checkpoints]
  const last = saved.at(-1)?.step ?? 0
  for (let s = last + SAVE_EVERY; s <= step && job.status === "running"; s += SAVE_EVERY) {
    saved.push({ step: s, savedAt: "just now", sizeMB: saved[0]?.sizeMB ?? 1850 })
  }
  return saved
}

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
  return <JobView key={job.id} job={job} />
}

function JobView({ job }: { job: TrainJob }) {
  const { run, step, live, stepsPerSec, elapsedSec, remainingSec } = useJobRun(job)
  const status = JOB_STATUS[job.status]
  const pct = Math.round((step / job.total) * 100)
  const cost = job.pricePerHr ? (job.pricePerHr * elapsedSec) / 3600 : undefined
  const checkpoints = checkpointsAt(job, step)
  const [ckptOpen, setCkptOpen] = useState(false)

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
                value: cost ? `$${cost.toFixed(2)}` : "$0.00",
                sub: `$${job.pricePerHr?.toFixed(2)}/h`,
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
          <Panel
            title="Checkpoints"
            className="shrink-0"
            action={
              <span className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                {checkpoints.length}
                {checkpoints.length > 0 && (
                  <button type="button" className="text-foreground hover:underline" onClick={() => setCkptOpen(true)}>
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

          <Panel title="Config" className="shrink-0">
            <JobConfig job={job} />
          </Panel>
          <CheckpointsDialog job={job} run={run} checkpoints={checkpoints} open={ckptOpen} onOpenChange={setCkptOpen} />
        </div>
      </div>
    </Page>
  )
}

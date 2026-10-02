import { useState } from "react"
import { Link } from "react-router-dom"
import { LuChevronRight, LuCloud, LuPlay, LuServer } from "react-icons/lu"

import { Page, Panel } from "@/components/app/page"
import { StatusDot } from "@/components/app/status-dot"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DATASETS } from "@/dummy/datasets"
import { JOBS, LOCAL_GPUS, POLICY, POLICY_BASE, RUNPOD_GPUS, isActive, type Compute, type TrainJob } from "@/dummy/training"
import { cn } from "@/lib/utils"

import { JOB_STATUS, computeText, jobPct } from "./jobs"

// 학습에 쓸 수 있는 데이터셋: 변환이 끝난 LeRobot 만
const TRAINABLE = DATASETS.filter((d) => d.kind === "lerobot" && d.status === "ready").map((d) => d.repoId)

type Tab = "active" | "finished"

function JobRow({ job }: { job: TrainJob }) {
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

        <div
          className="col-span-2 h-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label={`${job.id} progress`}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={cn("h-full rounded-full", job.status === "running" ? "bg-info" : "bg-muted-foreground/40")}
            style={{ width: `${pct}%` }}
          />
        </div>

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
        </div>
      </Link>
    </li>
  )
}

function JobsPanel() {
  const [tab, setTab] = useState<Tab>("active")
  const active = JOBS.filter(isActive)
  const finished = JOBS.filter((j) => !isActive(j))
  const shown = tab === "active" ? active : finished

  return (
    <Panel
      className="min-h-0 flex-1"
      title="Jobs"
      action={
        <div className="flex rounded-md bg-muted p-0.5" role="tablist" aria-label="Jobs">
          {(
            [
              { id: "active", label: "Running", n: active.length },
              { id: "finished", label: "Finished", n: finished.length },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "h-7 rounded-[5px] px-3 text-xs transition-colors",
                tab === t.id ? "bg-background font-medium shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              <span className="ml-1 text-muted-foreground tabular-nums">{t.n}</span>
            </button>
          ))}
        </div>
      }
    >
      {shown.length === 0 ? (
        <p className="grid flex-1 place-items-center py-10 text-[13px] text-muted-foreground">
          {tab === "active" ? "돌고 있는 학습이 없습니다. 오른쪽에서 학습을 시작하세요." : "끝난 학습이 없습니다."}
        </p>
      ) : (
        <ul className="-mx-3 grid min-h-0 content-start gap-1 overflow-y-auto">
          {shown.map((j) => (
            <JobRow key={j.id} job={j} />
          ))}
        </ul>
      )}
    </Panel>
  )
}

function StartTraining() {
  const [compute, setCompute] = useState<Compute>("local")
  const [cloudGpu, setCloudGpu] = useState(RUNPOD_GPUS[1].name)
  const localBusy = JOBS.find((j) => j.compute === "local" && j.status === "running")

  return (
    <Panel title="Start training" className="min-h-0">
      <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto">
        <div className="grid gap-1.5">
          <span className="text-xs text-muted-foreground">Model</span>
          <div className="flex items-baseline justify-between gap-3 rounded-md bg-muted px-3 py-2 text-[13px]">
            <span className="font-medium">{POLICY}</span>
            <span className="truncate text-xs text-muted-foreground">{POLICY_BASE}</span>
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="t-dataset" className="text-xs font-normal text-muted-foreground">
            Dataset
          </Label>
          <Select defaultValue={TRAINABLE[0]}>
            <SelectTrigger id="t-dataset" className="h-9 w-full text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRAINABLE.map((d) => (
                <SelectItem key={d} value={d} className="text-[13px]">
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <span className="text-xs text-muted-foreground">Compute</span>
          <div className="grid grid-cols-2 rounded-md bg-muted p-0.5" role="radiogroup" aria-label="Compute">
            {(
              [
                { id: "local", label: "Local GPU", icon: LuServer },
                { id: "runpod", label: "RunPod", icon: LuCloud },
              ] as const
            ).map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={compute === c.id}
                onClick={() => setCompute(c.id)}
                className={cn(
                  "inline-flex h-8 items-center justify-center gap-1.5 rounded-[5px] text-[13px] transition-colors",
                  compute === c.id ? "bg-background font-medium shadow-xs" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <c.icon className="size-3.5" aria-hidden />
                {c.label}
              </button>
            ))}
          </div>

          {compute === "local" ? (
            <ul className="grid gap-1.5">
              {LOCAL_GPUS.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-[13px]">
                  <span className="grid gap-0.5">
                    <span className="font-medium">{g.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {g.id}, {g.vram}
                    </span>
                  </span>
                  {localBusy ? (
                    <StatusDot tone="info" className="text-xs text-muted-foreground">
                      In use by {localBusy.id}
                    </StatusDot>
                  ) : (
                    <StatusDot tone="ok" className="text-xs text-muted-foreground">
                      Free
                    </StatusDot>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <ul className="grid gap-1.5" role="radiogroup" aria-label="RunPod GPU">
              {RUNPOD_GPUS.map((g) => {
                const on = g.name === cloudGpu
                return (
                  <li key={g.name}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setCloudGpu(g.name)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-accent/60",
                        on && "border-foreground/40 bg-accent hover:bg-accent",
                      )}
                    >
                      <span className="grid gap-0.5">
                        <span className="font-medium">{g.name}</span>
                        <span className="text-xs text-muted-foreground">{g.vram}</span>
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">${g.pricePerHr.toFixed(2)}/h</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1.5">
            <Label htmlFor="t-steps" className="text-xs font-normal text-muted-foreground">
              Steps
            </Label>
            <Input id="t-steps" className="h-9 text-[13px] tabular-nums" defaultValue="20000" inputMode="numeric" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="t-batch" className="text-xs font-normal text-muted-foreground">
              Batch size
            </Label>
            <Input id="t-batch" className="h-9 text-[13px] tabular-nums" defaultValue="64" inputMode="numeric" />
          </div>
        </div>
      </div>

      {compute === "local" && localBusy && (
        <p className="text-xs text-muted-foreground">로컬 GPU 가 사용 중이라 {localBusy.id} 가 끝나면 시작합니다.</p>
      )}
      <Button size="lg" className="w-full">
        <LuPlay />
        {compute === "local" && localBusy ? "Queue training" : "Start training"}
      </Button>
    </Panel>
  )
}

export function TrainingPage() {
  return (
    <Page
      fit
      title="Training"
      description="SmolVLA 를 로컬 GPU 나 RunPod 에서 학습합니다. Job 을 누르면 loss 와 checkpoint 를 볼 수 있습니다."
    >
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <JobsPanel />
        <StartTraining />
      </div>
    </Page>
  )
}

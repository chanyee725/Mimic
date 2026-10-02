import { useState } from "react"
import { Link } from "react-router-dom"
import { LuChevronRight, LuCloud, LuPlay, LuServer, LuSlidersHorizontal } from "react-icons/lu"

import { Page, Panel } from "@/components/app/page"
import { StatusDot } from "@/components/app/status-dot"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DATASETS } from "@/dummy/datasets"
import {
  JOBS,
  LOCAL_GPUS,
  POLICY,
  POLICY_BASE,
  RUNPOD_DEFAULTS,
  RUNPOD_GPUS,
  isActive,
  type Compute,
  type RunPodOptions,
  type TrainJob,
} from "@/dummy/training"
import { cn } from "@/lib/utils"

import { JOB_STATUS, computeText, jobPct, runpodRate, runpodSummary } from "./jobs"
import { overrideFlags, type Overrides } from "./params"
import { ConfirmTrainingDialog, type TrainingPlan } from "./confirm-dialog"
import { GpuPickerDialog } from "./gpu-picker-dialog"
import { ParamsDialog } from "./params-dialog"
import { RunPodDialog } from "./runpod-dialog"

// 학습에 쓸 수 있는 데이터셋: 변환이 끝난 LeRobot 만
const TRAINABLE = DATASETS.filter((d) => d.kind === "lerobot" && d.status === "ready").map((d) => d.repoId)

type Tab = "all" | "active" | "finished"

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
          {job.podState?.state === "idle" && <span className="text-warn">Pod still running, ${job.pricePerHr?.toFixed(2)}/h</span>}
        </div>
      </Link>
    </li>
  )
}

function JobsPanel() {
  const [tab, setTab] = useState<Tab>("all")
  const active = JOBS.filter(isActive)
  const finished = JOBS.filter((j) => !isActive(j))
  const shown = tab === "all" ? JOBS : tab === "active" ? active : finished

  return (
    <Panel
      className="min-h-0 flex-1"
      title="Jobs"
      action={
        <div className="flex rounded-md bg-muted p-0.5" role="tablist" aria-label="Jobs">
          {(
            [
              { id: "all", label: "All", n: JOBS.length },
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
          {tab !== "finished" ? "돌고 있는 학습이 없습니다. 오른쪽에서 학습을 시작하세요." : "끝난 학습이 없습니다."}
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
  const [dataset, setDataset] = useState(TRAINABLE[0])
  const [cloudGpu, setCloudGpu] = useState("A100 SXM")
  const [gpuOpen, setGpuOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [podOpts, setPodOpts] = useState<RunPodOptions>(RUNPOD_DEFAULTS)
  const [podOpen, setPodOpen] = useState(false)
  const cloud = RUNPOD_GPUS.find((g) => g.name === cloudGpu) ?? RUNPOD_GPUS[0]
  const podRate = runpodRate(cloud.pricePerHr, podOpts)
  const podCap = podOpts.budget ? Math.min(podOpts.maxHours || Infinity, podOpts.budget / podRate) : podOpts.maxHours
  const localBusy = JOBS.find((j) => j.compute === "local" && j.status === "running")
  const [paramsOpen, setParamsOpen] = useState(false)
  const [overrides, setOverrides] = useState<Overrides>({})
  const changed = overrideFlags(overrides)
  const plan: TrainingPlan = {
    dataset,
    compute,
    gpu: compute === "local" ? LOCAL_GPUS[0].name : cloud.name,
    queuedBehind: compute === "local" ? localBusy?.id : undefined,
    runpod: compute === "runpod" ? { options: podOpts, rate: podRate, capHours: podCap } : undefined,
    flags: changed,
  }

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
          <Select value={dataset} onValueChange={(v) => v && setDataset(v as string)}>
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
            <button
              type="button"
              onClick={() => setGpuOpen(true)}
              className="flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-accent/60"
            >
              <span className="grid gap-0.5">
                <span className="font-medium">{cloud.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {cloud.vramGB} GB, ${cloud.pricePerHr.toFixed(2)}/h
                </span>
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {RUNPOD_GPUS.length} GPUs
                <LuChevronRight className="size-4" aria-hidden />
              </span>
            </button>
          )}
        </div>

        {compute === "runpod" && (
          <div className="grid gap-1.5">
            <span className="text-xs text-muted-foreground">RunPod options</span>
            <button
              type="button"
              onClick={() => setPodOpen(true)}
              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-accent/60"
            >
              <span className="grid min-w-0 gap-0.5">
                <span className="font-medium tabular-nums">
                  ${podRate.toFixed(2)}/h
                  {podCap > 0 && <span className="font-normal text-muted-foreground">, up to ${(podRate * podCap).toFixed(2)}</span>}
                </span>
                <span className="truncate text-xs text-muted-foreground">{runpodSummary(podOpts)}</span>
              </span>
              <LuSlidersHorizontal className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          </div>
        )}

        <div className="grid gap-1.5">
          <span className="text-xs text-muted-foreground">Parameters</span>
          <button
            type="button"
            onClick={() => setParamsOpen(true)}
            className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-accent/60"
          >
            <span className="grid min-w-0 gap-0.5">
              <span className="font-medium">{changed.length ? `${changed.length} changed` : "SmolVLA defaults"}</span>
              <span className="truncate text-xs text-muted-foreground">
                {changed.length
                  ? changed.map((f) => f.replace(/^--(policy\.)?/, "")).join(", ")
                  : "Steps, batch size, learning rate and more"}
              </span>
            </span>
            <LuSlidersHorizontal className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </div>
      </div>

      {compute === "local" && localBusy && (
        <p className="text-xs text-muted-foreground">로컬 GPU 가 사용 중이라 {localBusy.id} 가 끝나면 시작합니다.</p>
      )}
      <Button size="lg" className="w-full" onClick={() => setConfirmOpen(true)}>
        <LuPlay />
        {compute === "local" && localBusy ? "Queue training" : "Start training"}
      </Button>
      <GpuPickerDialog
        open={gpuOpen}
        onOpenChange={setGpuOpen}
        value={cloud.name}
        onSelect={(name) => {
          setCloudGpu(name)
          // Community 에 없는 GPU 면 Secure 로 돌린다
          if (!RUNPOD_GPUS.find((g) => g.name === name)?.community) setPodOpts((o) => ({ ...o, cloud: "secure" }))
        }}
      />
      <ConfirmTrainingDialog open={confirmOpen} onOpenChange={setConfirmOpen} plan={plan} onConfirm={() => {}} />
      <RunPodDialog
        communityOk={cloud.community}
        open={podOpen}
        onOpenChange={setPodOpen}
        gpu={cloud.name}
        basePrice={cloud.pricePerHr}
        options={podOpts}
        onSave={setPodOpts}
      />
      <ParamsDialog open={paramsOpen} onOpenChange={setParamsOpen} overrides={overrides} onSave={setOverrides} />
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

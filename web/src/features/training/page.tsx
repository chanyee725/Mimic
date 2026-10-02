import { useState } from "react"
import { LuBox, LuClock, LuCpu, LuDownload, LuHourglass, LuLayers, LuSend } from "react-icons/lu"

import { Page, Panel } from "@/components/app/page"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  CHECKPOINTS,
  DATASETS,
  GPUS,
  JOBS,
  POLICIES,
  lossCurve,
  type JobStatus,
  type TrainJob,
} from "@/dummy/training"
import { cn } from "@/lib/utils"
import { LossChart } from "@/features/training/loss-chart"


function NewJobForm() {
  const [gpu, setGpu] = useState("A100")

  return (
    <Panel title="New job" action={<span className="text-[13px] text-muted-foreground">Submit to RunPod</span>}>
      <div className="grid min-h-0 flex-1 content-start gap-3.5 overflow-y-auto">
        <div className="grid gap-1.5">
          <Label>Policy</Label>
          <Select defaultValue={POLICIES[0]}>
            <SelectTrigger className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {POLICIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Dataset</Label>
          <Select defaultValue={DATASETS[0]}>
            <SelectTrigger className="h-9 w-full font-mono text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATASETS.map((d) => (
                <SelectItem key={d} value={d} className="font-mono text-[13px]">
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <span className="text-sm font-medium">GPU</span>
          <div className="grid grid-cols-3 gap-1.5">
            {GPUS.map((g) => {
              const selected = g.name === gpu
              return (
                <button
                  key={g.name}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setGpu(g.name)}
                  className={cn(
                    "grid h-14 place-content-center gap-0.5 rounded-md border bg-background text-center text-[13px] transition-colors hover:bg-muted/40",
                    selected && "border-foreground ring-1 ring-foreground",
                  )}
                >
                  <span className="font-medium">{g.name}</span>
                  <span className="text-[11px] text-muted-foreground">{g.vram}</span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1.5">
            <Label htmlFor="steps">Steps</Label>
            <Input id="steps" className="h-9 font-mono text-[13px]" defaultValue="100000" inputMode="numeric" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="batch">Batch size</Label>
            <Input id="batch" className="h-9 font-mono text-[13px]" defaultValue="8" inputMode="numeric" />
          </div>
        </div>
        <div className="flex justify-between text-[13px] text-muted-foreground">
          <span>lerobot pinned</span>
          <span className="font-mono text-foreground">[COMMIT HASH]</span>
        </div>
      </div>
      <Button size="lg" className="h-10">
        <LuSend />
        Submit job
      </Button>
    </Panel>
  )
}

const STATUS_BAR: Record<JobStatus, string> = {
  running: "bg-info",
  done: "bg-ok",
  queued: "bg-muted-foreground/40",
  failed: "bg-bad",
}

function jobPct(j: TrainJob) {
  return j.epochs ? Math.round(((j.epoch ?? 0) / j.epochs) * 100) : Math.round((j.step / j.total) * 100)
}

function JobRow({ job, selected, onSelect }: { job: TrainJob; selected: boolean; onSelect: () => void }) {
  const pct = jobPct(job)
  const meta = [
    { icon: LuCpu, label: "GPU", value: job.gpu },
    { icon: LuLayers, label: "Epoch", value: job.epochs ? `${job.epoch}/${job.epochs}` : "—" },
    { icon: LuClock, label: "Elapsed", value: job.elapsed ?? "—" },
    { icon: LuHourglass, label: "ETA", value: job.eta ?? "—" },
  ]

  return (
    <li className="py-1">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          "grid w-full gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-muted/50",
          selected && "bg-muted/60 hover:bg-muted/60",
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="grid min-w-0 gap-0.5">
            <div className="flex items-center gap-2">
              <span
                className={cn("size-1.5 shrink-0 rounded-full", STATUS_BAR[job.status], job.status === "running" && "animate-pulse")}
                aria-hidden
              />
              <span className="truncate text-sm font-semibold">{job.taskId ?? job.dataset}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{job.status}</span>
            </div>
            <span className="truncate pl-3.5 text-xs text-muted-foreground">
              {job.policy} · <span className="font-mono">{job.pod ?? job.id}</span>
            </span>
          </div>
          <span className="font-mono text-xl font-medium tracking-tight">
            {pct}
            <span className="text-sm text-muted-foreground">%</span>
          </span>
        </div>

        <div
          className="h-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label={`${job.id} progress`}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className={cn("h-full rounded-full", STATUS_BAR[job.status])} style={{ width: `${pct}%` }} />
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
          {meta.map((m) => (
            <div key={m.label} className="flex min-w-0 items-center gap-1.5" title={m.label}>
              <dt className="shrink-0 text-muted-foreground">
                <m.icon className="size-3.5" aria-hidden />
                <span className="sr-only">{m.label}</span>
              </dt>
              <dd className="truncate font-mono">{m.value}</dd>
            </div>
          ))}
        </dl>
      </button>
    </li>
  )
}

export function TrainingPage() {
  const [selectedId, setSelectedId] = useState(() => (JOBS.find((j) => j.status === "running") ?? JOBS[0]).id)
  const selected = JOBS.find((j) => j.id === selectedId) ?? JOBS[0]
  const running = JOBS.filter((j) => j.status === "running").length

  return (
    <Page fit title="Training" description="RunPod GPU · lerobot-train">
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-h-0 flex-col gap-4">
          <Panel
            title="Jobs"
            className="flex-1"
            action={
              <span className="text-[13px] text-muted-foreground">
                {running} running · {JOBS.length} total
              </span>
            }
          >
            <ul className="-mx-2 min-h-0 flex-1 divide-y overflow-y-auto">
              {JOBS.map((j) => (
                <JobRow key={j.id} job={j} selected={j.id === selected.id} onSelect={() => setSelectedId(j.id)} />
              ))}
            </ul>
          </Panel>

          <div className="grid shrink-0 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Panel
              title={
                <>
                  Loss · <span className="font-mono font-medium">{selected.id}</span>
                </>
              }
              action={
                <span className="font-mono text-xs text-muted-foreground">
                  step {selected.step.toLocaleString()} / {selected.total.toLocaleString()}
                </span>
              }
            >
              {selected.step > 0 ? (
                <LossChart className="h-44" curve={lossCurve(14, Math.floor(selected.step / 1000) + 1)} />
              ) : (
                <p className="grid h-44 place-items-center text-sm text-muted-foreground">아직 학습이 시작되지 않았습니다.</p>
              )}
            </Panel>

            <Panel title="Checkpoints">
              <ul className="-mx-2 divide-y">
                {CHECKPOINTS.map((c) => (
                  <li key={c.name} className="grid grid-cols-[minmax(0,1fr)] gap-1.5 rounded-md px-2 py-2.5 transition-colors hover:bg-muted/50">
                    <span className="truncate font-mono text-[13px]">{c.name}</span>
                    <div className="flex min-w-0 items-center gap-1">
                      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{c.meta}</span>
                      <Button variant="ghost" size="icon-sm" aria-label={`Download ${c.name}`} title="Download">
                        <LuDownload />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label={`Evaluate ${c.name} in Sim`} title="Eval in Sim">
                        <LuBox />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>

        <NewJobForm />
      </div>
    </Page>
  )
}

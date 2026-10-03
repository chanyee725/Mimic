import { Link } from "react-router-dom"
import { LuClock, LuCpu, LuHourglass, LuLayers } from "react-icons/lu"

import { ProgressBar } from "@/components/common/progress-bar"
import { jobPct, type TrainJob } from "@/domain/training"
import { formatDuration } from "@/lib/format"

export function PodRow({ job }: { job: TrainJob }) {
  const pct = jobPct(job)
  const meta = [
    { icon: LuCpu, label: "GPU", value: job.gpu },
    { icon: LuLayers, label: "Epoch", value: job.epochs ? `${job.epoch}/${job.epochs}` : "—" },
    { icon: LuClock, label: "Elapsed", value: job.elapsedS == null ? "—" : formatDuration(job.elapsedS) },
    { icon: LuHourglass, label: "ETA", value: job.etaS == null ? "—" : formatDuration(job.etaS) },
  ]

  return (
    <li className="py-1.5">
      <Link
        to={`/training/${job.id}`}
        className="-mx-2 grid gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="grid min-w-0 gap-0.5">
            <div className="flex items-center gap-2">
              <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-info" aria-hidden />
              <span className="truncate text-sm font-semibold">{job.taskId ?? job.dataset}</span>
            </div>
            <span className="truncate pl-3.5 text-xs text-muted-foreground">
              {job.policy} · {job.compute === "local" ? "Local GPU" : (job.pod ?? "RunPod")}
            </span>
          </div>
          <span className="font-mono text-xl font-medium tracking-tight">
            {pct}
            <span className="text-sm text-muted-foreground">%</span>
          </span>
        </div>

        <ProgressBar value={pct} label={`${job.id} progress`} size="xs" />

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
      </Link>
    </li>
  )
}

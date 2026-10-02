import { Link } from "react-router-dom"
import type { IconType } from "react-icons"
import { LuCircleCheck, LuClock, LuCpu, LuFilm, LuHardDrive, LuHourglass, LuLayers, LuListVideo, LuTimer } from "react-icons/lu"

import { Page, Panel, PanelLink } from "@/components/app/page"
import { StatStrip } from "@/components/app/stat-strip"
import { SESSIONS } from "@/dummy/sessions"
import { CURRENT_TASK_ID, DATA_TOTALS, STATION } from "@/dummy/station"
import { TASKS, type Task, type TaskStatus } from "@/dummy/tasks"
import { JOBS, type TrainJob } from "@/dummy/training"
import { EpisodeHeatmap } from "@/features/dashboard/episode-heatmap"

const MAX_TASKS = 6
const MAX_PODS = 2

const TOTAL_ICONS: Record<(typeof DATA_TOTALS)[number]["key"], IconType> = {
  episodes: LuListVideo,
  frames: LuFilm,
  hours: LuTimer,
  storage: LuHardDrive,
  success: LuCircleCheck,
}

const STATUS_ORDER: Record<TaskStatus, number> = { active: 0, completed: 1, draft: 2 }
const RING_CLASS: Record<TaskStatus, string> = {
  active: "stroke-foreground",
  completed: "stroke-ok",
  draft: "stroke-muted-foreground/40",
}

/** 원형 진행도. 가운데에 % 표시 */
function ProgressRing({ pct, status, label }: { pct: number; status: TaskStatus; label: string }) {
  const r = 22
  const c = 2 * Math.PI * r
  return (
    <div
      className="relative size-14 shrink-0"
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg viewBox="0 0 56 56" className="size-full -rotate-90">
        <circle cx={28} cy={28} r={r} fill="none" strokeWidth={5} className="stroke-muted" />
        <circle
          cx={28}
          cy={28}
          r={r}
          fill="none"
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          className={RING_CLASS[status]}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-mono text-xs font-medium">{pct}%</span>
    </div>
  )
}

function TaskRow({ task }: { task: Task }) {
  const sessions = SESSIONS.filter((s) => s.taskId === task.id)
  const episodes = sessions.reduce((a, s) => a + s.episodes, 0)
  const success = episodes ? Math.round(sessions.reduce((a, s) => a + s.successPct * s.episodes, 0) / episodes) : null
  const pct = Math.min(100, Math.round((task.collected / task.targetEpisodes) * 100))
  const current = task.id === CURRENT_TASK_ID

  return (
    <li className="flex min-h-16 flex-1">
      <Link to={`/tasks/${task.id}`} className="flex w-full items-center gap-4 rounded-md px-2 py-2.5 transition-colors hover:bg-muted/50">
        <div className="grid min-w-0 flex-1 gap-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate font-mono text-sm font-medium">{task.id}</span>
            {current && <span className="shrink-0 rounded-sm bg-bad-muted px-1.5 text-[11px] font-medium text-bad">REC</span>}
          </div>
          <p className="truncate text-[13px] text-muted-foreground">{task.instruction}</p>
          <div className="flex flex-wrap gap-x-3 font-mono text-[11px] whitespace-nowrap text-muted-foreground">
            <span className="text-foreground">
              {task.collected} / {task.targetEpisodes}
            </span>
            <span>
              {sessions.length} {sessions.length === 1 ? "session" : "sessions"}
            </span>
            <span>success {success === null ? "—" : `${success}%`}</span>
          </div>
        </div>
        <ProgressRing pct={pct} status={task.status} label={`${task.id} progress`} />
      </Link>
    </li>
  )
}

function TaskList() {
  // 현재 Capture 중인 Task 를 맨 위에, 나머지는 상태 순
  const tasks = [...TASKS].sort((a, b) =>
    a.id === CURRENT_TASK_ID ? -1 : b.id === CURRENT_TASK_ID ? 1 : STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
  )
  const shown = tasks.slice(0, MAX_TASKS)
  const hidden = tasks.length - shown.length

  return (
    <Panel title="Tasks" action={<PanelLink to="/tasks">{hidden > 0 ? `+${hidden} more` : `${tasks.length} tasks`}</PanelLink>}>
      {/* 행이 패널 높이를 나눠 채우고, 부족하면 패널 안에서만 스크롤 */}
      <ul className="-mx-2 flex min-h-0 flex-1 flex-col divide-y overflow-y-auto">
        {shown.map((t) => (
          <TaskRow key={t.id} task={t} />
        ))}
      </ul>
    </Panel>
  )
}

function PodRow({ job }: { job: TrainJob }) {
  const pct = Math.round((job.step / job.total) * 100)
  const meta = [
    { icon: LuCpu, label: "GPU", value: job.gpu },
    { icon: LuLayers, label: "Epoch", value: job.epochs ? `${job.epoch}/${job.epochs}` : "—" },
    { icon: LuClock, label: "Elapsed", value: job.elapsed ?? "—" },
    { icon: LuHourglass, label: "ETA", value: job.eta ?? "—" },
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

        <div
          className="h-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label={`${job.id} progress`}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full rounded-full bg-info" style={{ width: `${pct}%` }} />
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
      </Link>
    </li>
  )
}

function TrainingPods() {
  const running = JOBS.filter((j) => j.status === "running")
  const hidden = running.length - MAX_PODS

  return (
    <Panel title="Training" className="flex-1" action={<PanelLink to="/training">{hidden > 0 ? `+${hidden} more` : "View all"}</PanelLink>}>
      {running.length === 0 ? (
        <p className="text-sm text-muted-foreground">실행 중인 학습이 없습니다.</p>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col divide-y overflow-y-auto">
          {running.slice(0, MAX_PODS).map((j) => (
            <PodRow key={j.id} job={j} />
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function DashboardPage() {
  return (
    <Page fit title="Dashboard" description={`${STATION.id} · ${STATION.robot} · ${STATION.date}`}>
      <StatStrip items={DATA_TOTALS.map((t) => ({ ...t, icon: TOTAL_ICONS[t.key] }))} />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <TaskList />
        <div className="flex min-h-0 flex-col gap-4">
          <Panel className="shrink-0">
            <EpisodeHeatmap />
          </Panel>
          <TrainingPods />
        </div>
      </div>
    </Page>
  )
}

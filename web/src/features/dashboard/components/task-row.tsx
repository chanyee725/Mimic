import { Link } from "react-router-dom"

import { ProgressRing } from "@/components/app/progress-ring"
import { SESSIONS } from "@/dummy/sessions"
import { CURRENT_TASK_ID } from "@/dummy/station"
import type { Task } from "@/dummy/tasks"
import { plural } from "@/lib/format"

export function TaskRow({ task }: { task: Task }) {
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
            <span>{plural(sessions.length, "session")}</span>
            <span>success {success === null ? "—" : `${success}%`}</span>
          </div>
        </div>
        {/* Dashboard uses a slightly smaller ring and a monospace % label */}
        <ProgressRing
          pct={pct}
          status={task.status}
          label={`${task.id} progress`}
          radius={22}
          labelClassName="font-mono text-xs tracking-normal"
        />
      </Link>
    </li>
  )
}

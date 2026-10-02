import { ProgressRing } from "@/components/app/progress-ring"
import type { Task } from "@/dummy/tasks"

/** 이번 세션에서 저장한 에피소드까지 포함한 수집 진행도 */
export function TaskProgress({ task, collected }: { task: Task; collected: number }) {
  const pct = Math.min(100, Math.round((collected / task.targetEpisodes) * 100))
  return (
    <div className="flex items-center gap-4">
      <ProgressRing pct={pct} status={task.status} label="Task progress" className="size-16" />
      <div className="grid gap-0.5">
        <span className="text-xs text-muted-foreground">Progress</span>
        <span className="text-xl font-semibold tabular-nums">
          {collected}
          <span className="text-sm font-normal text-muted-foreground"> / {task.targetEpisodes}</span>
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">{Math.max(0, task.targetEpisodes - collected)} remaining</span>
      </div>
    </div>
  )
}

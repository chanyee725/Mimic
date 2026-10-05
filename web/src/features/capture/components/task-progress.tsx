import { ProgressRing } from "@/components/common/progress-ring"
import { TASK_RING_TONE, type Task } from "@/domain/task"

/** Collection progress (the server refetches `collected` after every save) */
export function TaskProgress({ task }: { task: Task }) {
  const collected = task.collected
  const pct = Math.min(100, Math.round((collected / task.targetEpisodes) * 100))
  return (
    <div className="flex items-center gap-3">
      <ProgressRing pct={pct} tone={TASK_RING_TONE[task.status]} label="Task progress" className="size-12" />
      <div className="grid">
        <span className="text-lg font-semibold tabular-nums">
          {collected}
          <span className="text-sm font-normal text-muted-foreground"> / {task.targetEpisodes}</span>
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">{Math.max(0, task.targetEpisodes - collected)} remaining</span>
      </div>
    </div>
  )
}

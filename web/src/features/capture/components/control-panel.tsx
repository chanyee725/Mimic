import { Panel } from "@/components/layout/page-layout"
import { TaskPicker } from "@/components/pickers/task-picker"
import type { Task } from "@/domain/task"

import type { CaptureControls } from "../hooks/use-capture"
import { EpisodeControls } from "./episode-controls"
import { ErrorNote } from "./query-note"
import { RecordingStatus } from "./recording-status"
import { TaskProgress } from "./task-progress"

/** Right panel: progress, task info, recording status and controls */
export function ControlPanel({
  task,
  ep,
  onSelectTask,
  taskError,
}: {
  task: Task
  ep: CaptureControls
  onSelectTask: (id: string) => void
  taskError: Error | null
}) {
  return (
    <Panel className="gap-5 overflow-y-auto">
      <TaskProgress task={task} />

      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <span className="text-xs text-muted-foreground">Task</span>
          <TaskPicker task={task} onSelect={onSelectTask} disabled={ep.phase !== "idle"} />
          <ErrorNote error={taskError} />
        </div>
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">Label</span>
          <p className="text-[13px] leading-snug">{task.instruction}</p>
        </div>
      </div>

      <RecordingStatus task={task} phase={ep.phase} episode={ep.episode} elapsedS={ep.elapsedS} lastOutcome={ep.lastOutcome} />

      <EpisodeControls
        phase={ep.phase}
        busy={ep.busy}
        error={ep.error}
        onToggle={ep.toggle}
        onSave={ep.save}
        onRestart={ep.rerecord}
        onDiscard={ep.discard}
      />
    </Panel>
  )
}

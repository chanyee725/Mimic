import { Panel } from "@/components/layout/page-layout"
import { TaskPicker } from "@/components/pickers/task-picker"
import type { Task } from "@/dummy/tasks"

import type { EpisodeState } from "../hooks/use-episode"
import { EpisodeControls } from "./episode-controls"
import { RecordingStatus } from "./recording-status"
import { TaskProgress } from "./task-progress"

/** Right panel: progress, task info, recording status and controls */
export function ControlPanel({ task, ep, onSelectTask }: { task: Task; ep: EpisodeState; onSelectTask: (id: string) => void }) {
  return (
    <Panel className="gap-5 overflow-y-auto">
      <TaskProgress task={task} collected={ep.episode - 1} />

      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <span className="text-xs text-muted-foreground">Task</span>
          <TaskPicker task={task} onSelect={onSelectTask} disabled={ep.phase !== "idle"} />
        </div>
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">Label</span>
          <p className="text-[13px] leading-snug">{task.instruction}</p>
        </div>
      </div>

      <RecordingStatus task={task} phase={ep.phase} episode={ep.episode} elapsedMs={ep.elapsedMs} lastOutcome={ep.lastOutcome} />

      <EpisodeControls phase={ep.phase} onToggle={ep.toggle} onSave={ep.save} onRestart={ep.start} onDiscard={ep.discard} />
    </Panel>
  )
}

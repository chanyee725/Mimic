import { Link } from "react-router-dom"

import { Panel } from "@/components/layout/page-layout"
import { TaskPicker } from "@/components/pickers/task-picker"
import type { Task } from "@/domain/task"

import type { CaptureControls } from "../hooks/use-capture"
import { targetReached } from "../lib"
import { EpisodeControls } from "./episode-controls"
import { ErrorNote } from "@/components/common/query-state"
import { RecordingStatus } from "./recording-status"
import { TaskProgress } from "./task-progress"
import { TeleopRow } from "./teleop-row"

/** Right panel: progress, task info, recording status and controls */
export function ControlPanel({
  task,
  ep,
  offline,
  simEnv,
  onSelectTask,
  taskError,
}: {
  task: Task
  ep: CaptureControls
  /** Names of required devices that are not connected */
  offline: string[]
  /** Isaac Sim environment when the task's rig is a sim rig */
  simEnv: string | null
  onSelectTask: (id: string) => void
  taskError: Error | null
}) {
  return (
    <Panel className="gap-4 overflow-y-auto">
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

      <TeleopRow rigId={task.rigId} locked={ep.phase !== "idle"} simEnv={simEnv} />

      <RecordingStatus
        task={task}
        phase={ep.phase}
        episode={ep.episode}
        elapsedS={ep.elapsedS}
        countdownLeftS={ep.countdownLeftS}
        lastOutcome={ep.lastOutcome}
      />

      <EpisodeControls
        phase={ep.phase}
        busy={ep.busy}
        blocked={ep.phase === "idle" ? startBlockedNote(task, offline, simEnv) : null}
        error={ep.error}
        onToggle={ep.toggle}
        onSave={ep.save}
        onRestart={ep.rerecord}
        onDiscard={ep.discard}
      />
    </Panel>
  )
}

/** Why a new episode can't start: a sim rig (Isaac Sim not connected), the task's target is reached, or rig devices are offline */
function startBlockedNote(task: Task, offline: string[], simEnv: string | null): React.ReactNode | null {
  if (simEnv) return <>Isaac Sim 연결 전이라 이 Task({simEnv}) 는 아직 녹화할 수 없습니다.</>
  if (targetReached(task))
    return (
      <>
        목표 에피소드 수({task.targetEpisodes}개)를 모두 채웠습니다. 더 녹화하려면{" "}
        <Link to="/tasks" className="text-foreground underline underline-offset-2">
          Tasks
        </Link>
        에서 목표 수를 늘리세요.
      </>
    )
  if (offline.length > 0)
    return (
      <>
        연결되지 않은 장치가 있어 녹화를 시작할 수 없습니다: <span className="text-foreground">{offline.join(", ")}</span>. Rigs 에서 장치를
        연결하세요.
      </>
    )
  return null
}

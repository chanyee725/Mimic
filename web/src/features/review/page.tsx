import { useState } from "react"
import { LuUpload } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { Page, Panel } from "@/components/layout/page-layout"
import { TaskPicker } from "@/components/pickers/task-picker"
import { deleteRecording, useRecordings } from "@/api/recordings"
import { getTask, listTasks } from "@/api/tasks"

import { DeleteRecordingDialog } from "./components/delete-recording-dialog"
import { EpisodeList } from "./components/episode-list"
import { McapPlayer } from "./components/mcap-player"
import { ReviewActions } from "./components/review-actions"
import { latestFirst } from "./lib"

export function ReviewPage() {
  const recordings = useRecordings()
  const [taskId, setTaskId] = useState(() => listTasks()[0].id)
  const task = getTask(taskId)!
  const episodes = latestFirst(recordings.filter((r) => r.taskId === taskId))
  const [selectedId, setSelectedId] = useState<string | null>(episodes[0]?.id ?? null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const selected = episodes.find((r) => r.id === selectedId) ?? episodes[0] ?? null

  const changeTask = (id: string) => {
    setTaskId(id)
    setSelectedId(latestFirst(recordings.filter((r) => r.taskId === id))[0]?.id ?? null)
  }

  const remove = (id: string) => {
    const idx = episodes.findIndex((r) => r.id === id)
    const next = episodes.filter((r) => r.id !== id)
    deleteRecording(id)
    setSelectedId(next[Math.min(idx, next.length - 1)]?.id ?? null)
    setConfirmDelete(false)
  }

  return (
    <Page
      fit
      title="Review"
      description="Task 를 고르고 녹화한 에피소드를 재생해 승인, 거절하거나 지웁니다. 승인한 에피소드만 Convert 에서 변환할 수 있습니다."
      actions={
        <Button variant="outline" size="lg">
          <LuUpload />
          Import MCAP
        </Button>
      }
    >
      {/* Same layout as Capture: playback on the left 7, task / list / review on the right 3 */}
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
        <div className="flex min-h-[28rem] min-w-0 flex-col">
          {selected ? (
            // Keyed so playback restarts from the beginning whenever the file changes
            <McapPlayer key={selected.id} recording={selected} className="min-h-0 flex-1" />
          ) : (
            <EmptyState className="grid flex-1 place-items-center rounded-lg py-0 text-sm">
              이 Task 에는 아직 녹화된 에피소드가 없습니다.
            </EmptyState>
          )}
        </div>

        <Panel className="min-h-0 gap-4">
          <div className="grid gap-1.5">
            <span className="text-xs text-muted-foreground">Task</span>
            <TaskPicker task={task} onSelect={changeTask} />
          </div>

          <EpisodeList
            key={taskId}
            recordings={episodes}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
            className="min-h-40 flex-1"
          />

          {selected && <ReviewActions recording={selected} onDelete={() => setConfirmDelete(true)} />}
        </Panel>
      </div>

      <DeleteRecordingDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        file={selected?.file}
        onConfirm={() => selected && remove(selected.id)}
      />
    </Page>
  )
}

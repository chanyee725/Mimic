import { useState } from "react"
import { LuCheck, LuTrash2, LuUpload, LuX } from "react-icons/lu"

import { Page, Panel } from "@/components/app/page"
import { StatusDot } from "@/components/app/status-dot"
import { TaskPicker } from "@/components/app/task-picker"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getTask, TASKS } from "@/dummy/tasks"
import { deleteRecording, setReview, useRecordings } from "@/lib/recordings-store"
import { cn } from "@/lib/utils"
import { EpisodeList } from "./components/episode-list"
import { McapPlayer } from "./components/mcap-player"

const REVIEW_TONE = { pending: "muted", accepted: "ok", rejected: "bad" } as const

/** 가장 최근 에피소드부터 */
const latestFirst = <T extends { episode?: number }>(xs: T[]) => [...xs].sort((a, b) => (b.episode ?? 0) - (a.episode ?? 0))

export function ReviewPage() {
  const recordings = useRecordings()
  const [taskId, setTaskId] = useState(TASKS[0].id)
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
      {/* Capture 와 같은 배치: 좌 7 재생 · 우 3 Task / 목록 / 검수 */}
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
        <div className="flex min-h-[28rem] min-w-0 flex-col">
          {selected ? (
            <McapPlayer key={selected.id} recording={selected} className="min-h-0 flex-1" />
          ) : (
            <div className="grid flex-1 place-items-center rounded-lg border border-dashed text-sm text-muted-foreground">
              이 Task 에는 아직 녹화된 에피소드가 없습니다.
            </div>
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

          {selected && (
            <div className="grid shrink-0 gap-3 border-t pt-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[13px] font-medium">{selected.file.split("/").pop()}</span>
                <StatusDot tone={REVIEW_TONE[selected.review]} className="shrink-0 text-xs text-muted-foreground">
                  {selected.review}
                </StatusDot>
              </div>
              <dl className="grid gap-1">
                {selected.checks.map((c) => (
                  <div key={c.label} className="flex justify-between gap-3 text-xs">
                    <dt>
                      <StatusDot tone={c.ok ? "ok" : "bad"} className="text-xs text-muted-foreground">
                        {c.label}
                      </StatusDot>
                    </dt>
                    <dd className={cn("tabular-nums", c.ok ? "text-muted-foreground" : "text-bad")}>{c.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5">
                <Button
                  variant="outline"
                  className="h-9"
                  onClick={() => setReview(selected.id, "accepted")}
                  disabled={selected.review === "accepted"}
                >
                  <LuCheck />
                  Accept
                </Button>
                <Button
                  variant="outline"
                  className="h-9"
                  onClick={() => setReview(selected.id, "rejected")}
                  disabled={selected.review === "rejected"}
                >
                  <LuX />
                  Reject
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Delete recording"
                  title="Delete recording"
                  className="size-9 text-bad hover:text-bad"
                  onClick={() => setConfirmDelete(true)}
                >
                  <LuTrash2 />
                </Button>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete recording?</DialogTitle>
            <DialogDescription>{selected?.file} 파일을 삭제합니다. 삭제한 MCAP 은 되돌릴 수 없습니다.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button className="bg-destructive text-white hover:bg-destructive/90" onClick={() => selected && remove(selected.id)}>
              Delete recording
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  )
}

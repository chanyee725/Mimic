import { useState } from "react"

import { EmptyState } from "@/components/common/empty-state"
import { Panel } from "@/components/layout/page-layout"
import { useDeleteRecording, useRecordings } from "@/api/recordings"

import type { ReviewFilter } from "../lib"
import { DeleteRecordingDialog } from "./delete-recording-dialog"
import { EpisodeList } from "./episode-list"
import { McapPlayer } from "./mcap-player"
import { QueryNote } from "./query-note"
import { ReviewActions } from "./review-actions"

/**
 * Player, episode list and review actions for one task. The page keys it by task id,
 * so the filter and selection reset when the task changes.
 */
export function ReviewWorkspace({ taskId, taskPicker }: { taskId: string; taskPicker: React.ReactNode }) {
  const [filter, setFilter] = useState<ReviewFilter>("all")
  const recordings = useRecordings({ taskId, review: filter === "all" ? undefined : filter })
  const episodes = recordings.data?.pages.flatMap((p) => p.items) ?? []
  const total = recordings.data?.pages[0]?.total ?? 0

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const del = useDeleteRecording()

  // A recording that leaves the filtered list (accepted while viewing Pending) hands over to the first row
  const selected = episodes.find((r) => r.id === selectedId) ?? episodes[0] ?? null

  const remove = (id: string) => {
    const idx = episodes.findIndex((r) => r.id === id)
    const next = episodes.filter((r) => r.id !== id)
    del.mutate(id, {
      onSuccess: () => {
        setSelectedId(next[Math.min(idx, next.length - 1)]?.id ?? null)
        setConfirmDelete(false)
      },
    })
  }

  return (
    <>
      {/* Same layout as Capture: playback on the left 7, task / list / review on the right 3 */}
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
        <div className="flex min-h-[28rem] min-w-0 flex-col">
          {selected ? (
            // Keyed so playback restarts from the beginning whenever the file changes
            <McapPlayer key={selected.id} recording={selected} className="min-h-0 flex-1" />
          ) : (
            <EmptyState className="grid flex-1 place-items-center rounded-lg py-0 text-sm">
              {recordings.isPending || recordings.error ? (
                <QueryNote query={recordings} />
              ) : filter === "all" ? (
                "이 Task 에는 아직 녹화된 에피소드가 없습니다."
              ) : (
                "해당하는 에피소드가 없습니다."
              )}
            </EmptyState>
          )}
        </div>

        <Panel className="min-h-0 gap-4">
          <div className="grid gap-1.5">
            <span className="text-xs text-muted-foreground">Task</span>
            {taskPicker}
          </div>

          <EpisodeList
            recordings={episodes}
            total={total}
            query={recordings}
            filter={filter}
            onFilterChange={setFilter}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
            className="min-h-40 flex-1"
          />

          {selected && (
            <ReviewActions
              recording={selected}
              onDelete={() => {
                del.reset()
                setConfirmDelete(true)
              }}
            />
          )}
        </Panel>
      </div>

      <DeleteRecordingDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        file={selected?.file}
        pending={del.isPending}
        error={del.error}
        onConfirm={() => selected && remove(selected.id)}
      />
    </>
  )
}

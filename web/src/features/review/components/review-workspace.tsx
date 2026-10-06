import { useState } from "react"

import { EmptyState } from "@/components/common/empty-state"
import { Panel } from "@/components/layout/page-layout"
import { useBulkDelete, useDeleteRecording, useRecordings } from "@/api/recordings"
import type { RigKind } from "@/domain/rig"

import type { ReviewFilter } from "../lib"
import { BulkActions } from "./bulk-actions"
import { DeleteRecordingDialog } from "./delete-recording-dialog"
import { EpisodeList } from "./episode-list"
import { McapPlayer } from "./mcap-player"
import { QueryNote } from "@/components/common/query-state"
import { ReviewActions } from "./review-actions"

/**
 * Player, episode list and review actions for one task. The page keys it by task id,
 * so the filter and selection reset when the task or the rig kind changes.
 */
export function ReviewWorkspace({ taskId, kind, taskPicker }: { taskId: string; kind?: RigKind; taskPicker: React.ReactNode }) {
  const [filter, setFilter] = useState<ReviewFilter>("all")
  // Checked ids for the bulk actions; cleared when the filter changes
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set())
  const [checkingAll, setCheckingAll] = useState(false)
  const recordings = useRecordings({ taskId, kind, review: filter === "all" ? undefined : filter, order: "episode" })
  const episodes = recordings.data?.pages.flatMap((p) => p.items) ?? []
  const total = recordings.data?.pages[0]?.total ?? 0

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<"one" | "checked" | null>(null)
  const del = useDeleteRecording()
  const bulkDel = useBulkDelete()

  const check = (ids: string[], on: boolean) =>
    setChecked((prev) => {
      const next = new Set(prev)
      for (const id of ids)
        if (on) next.add(id)
        else next.delete(id)
      return next
    })
  const checkAll = async () => {
    setCheckingAll(true)
    try {
      // Every matching episode must be loaded before its id can be checked
      let { data, hasNextPage } = recordings
      while (hasNextPage) ({ data, hasNextPage } = await recordings.fetchNextPage())
      check(data?.pages.flatMap((p) => p.items.map((r) => r.id)) ?? [], true)
    } finally {
      setCheckingAll(false)
    }
  }
  // Rows deleted elsewhere drop out of the selection
  const checkedIds = episodes.filter((r) => checked.has(r.id)).map((r) => r.id)

  // A recording that leaves the filtered list (accepted while viewing Pending) hands over to the first row
  const selected = episodes.find((r) => r.id === selectedId) ?? episodes[0] ?? null

  const remove = (id: string) => {
    const idx = episodes.findIndex((r) => r.id === id)
    const next = episodes.filter((r) => r.id !== id)
    del.mutate(id, {
      onSuccess: () => {
        setSelectedId(next[Math.min(idx, next.length - 1)]?.id ?? null)
        setConfirmDelete(null)
      },
    })
  }
  const removeChecked = () =>
    bulkDel.mutate(checkedIds, {
      onSuccess: () => {
        setChecked(new Set())
        setConfirmDelete(null)
      },
    })

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
                "이 Task 에는 아직 녹화된 에피소드가 없습니다. Capture 에서 녹화하면 여기에 표시됩니다."
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
            onFilterChange={(f) => {
              setFilter(f)
              setChecked(new Set())
            }}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
            checked={new Set(checkedIds)}
            onCheck={check}
            onCheckAll={() => void checkAll()}
            checkingAll={checkingAll}
            className="min-h-40 flex-1"
          />

          {checkedIds.length > 0 ? (
            <BulkActions
              ids={checkedIds}
              onDone={() => setChecked(new Set())}
              onDelete={() => {
                bulkDel.reset()
                setConfirmDelete("checked")
              }}
            />
          ) : (
            selected && (
              <ReviewActions
                recording={selected}
                onDelete={() => {
                  del.reset()
                  setConfirmDelete("one")
                }}
              />
            )
          )}
        </Panel>
      </div>

      <DeleteRecordingDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        file={selected?.file}
        count={confirmDelete === "checked" ? checkedIds.length : undefined}
        pending={del.isPending || bulkDel.isPending}
        error={confirmDelete === "checked" ? bulkDel.error : del.error}
        onConfirm={() => (confirmDelete === "checked" ? removeChecked() : selected && remove(selected.id))}
      />
    </>
  )
}

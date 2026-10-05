import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { LuChevronRight } from "react-icons/lu"

import { Panel } from "@/components/layout/page-layout"
import { TaskPicker } from "@/components/pickers/task-picker"
import { useConvert, useConvertPreview } from "@/api/datasets"
import { useRecordings } from "@/api/recordings"
import { useRig } from "@/api/rigs"
import type { Task } from "@/domain/task"

import { previewText } from "../lib"
import { ConvertSummary } from "./convert-summary"
import { EpisodePickerDialog } from "./episode-picker-dialog"
import { OutputPanel } from "./output-panel"
import { QueryNote } from "@/components/common/query-state"

/** Task, episodes and output for one task. The page keys it by task id, so exclusions and the name reset on change */
export function ConvertWorkspace({ task, onSelectTask }: { task: Task; onSelectTask: (id: string) => void }) {
  const accepted = useRecordings({ taskId: task.id, review: "accepted" })
  const pending = useRecordings({ taskId: task.id, review: "pending" })
  const rig = useRig(task.rigId).data
  const acceptedItems = accepted.data?.pages.flatMap((p) => p.items) ?? []
  const acceptedTotal = accepted.data?.pages[0]?.total ?? 0
  const pendingTotal = pending.data?.pages[0]?.total ?? 0

  // Defaults to all accepted episodes
  const [excluded, setExcluded] = useState<string[]>([])
  const [repoId, setRepoId] = useState(task.repoId)
  const [pickerOpen, setPickerOpen] = useState(false)
  const preview = useConvertPreview(task.id, excluded)
  const count = preview.data?.episodes ?? 0

  const excludeAll = async () => {
    let res = accepted
    while (res.hasNextPage) res = await res.fetchNextPage()
    setExcluded(res.data?.pages.flatMap((p) => p.items.map((r) => r.id)) ?? [])
  }

  const convert = useConvert()
  const navigate = useNavigate()
  const start = () =>
    convert.mutate(
      { taskId: task.id, repoId: repoId.trim(), exclude: excluded },
      { onSuccess: (d) => navigate(`/datasets?repo=${encodeURIComponent(d.repoId)}`) },
    )

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* ── Left: what to convert (task · episodes) ── */}
        <section className="flex min-h-0 flex-col gap-4">
          <Panel title="Task" className="@container flex-1 gap-4">
            <TaskPicker task={task} onSelect={onSelectTask} />
            <dl className="divide-y">
              <div className="grid gap-1 pb-3">
                <dt className="text-xs text-muted-foreground">Label</dt>
                <dd className="text-[13px] leading-relaxed">{task.instruction}</dd>
              </div>
              {rig && (
                <div className="flex justify-between gap-3 py-2.5 text-[13px]">
                  <dt className="text-muted-foreground">Rig</dt>
                  <dd>
                    {rig.name}, {rig.joints.length} DoF
                  </dd>
                </div>
              )}
              <div className="py-1">
                <dt className="sr-only">Episodes</dt>
                <dd>
                  <button
                    type="button"
                    disabled={acceptedTotal === 0}
                    onClick={() => setPickerOpen(true)}
                    className="-mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-md px-2 py-1.5 text-[13px] transition-colors hover:bg-accent/60 disabled:pointer-events-none"
                  >
                    <span className="text-muted-foreground">Episodes</span>
                    <span className="flex items-center gap-1.5 tabular-nums">
                      {accepted.isPending ? "Loading…" : `${count.toLocaleString()} of ${acceptedTotal.toLocaleString()} accepted`}
                      <LuChevronRight className="size-3.5 text-muted-foreground" aria-hidden />
                    </span>
                  </button>
                </dd>
              </div>
            </dl>
            {preview.data ? <ConvertSummary preview={preview.data} /> : <QueryNote query={preview} />}
            <QueryNote query={accepted} />
            {!accepted.isPending && (acceptedTotal === 0 || pendingTotal > 0) && (
              <p className="text-xs text-muted-foreground">
                {acceptedTotal === 0 ? "승인된 에피소드가 없습니다. " : `검수를 기다리는 에피소드가 ${pendingTotal}개 있습니다. `}
                <Link to="/review" className="text-foreground underline underline-offset-4">
                  Review 에서 검수하기
                </Link>
              </p>
            )}
          </Panel>
        </section>

        {/* ── Right: result (output · convert) ── */}
        <section className="flex min-h-0 flex-col gap-4">
          <OutputPanel
            repoId={repoId}
            onRepoIdChange={setRepoId}
            fps={preview.data?.fps ?? task.videoFps}
            actionHz={preview.data?.actionHz ?? task.actionHz}
            preview={preview.data ? previewText(preview.data, task.instruction) : preview.error ? preview.error.message : "Loading…"}
            count={count}
            converting={convert.isPending}
            error={convert.error}
            onConvert={start}
          />
        </section>
      </div>

      <EpisodePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        taskId={task.id}
        accepted={acceptedItems}
        total={acceptedTotal}
        query={accepted}
        excluded={excluded}
        onExcludedChange={setExcluded}
        onExcludeAll={() => void excludeAll()}
      />
    </>
  )
}

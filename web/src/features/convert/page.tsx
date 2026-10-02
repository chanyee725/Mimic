import { useState } from "react"
import { Link } from "react-router-dom"
import { LuChevronRight } from "react-icons/lu"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Page, Panel } from "@/components/app/page"
import { getRig } from "@/dummy/rigs"
import { TASKS, getTask } from "@/dummy/tasks"
import { useRecordings } from "@/lib/recordings-store"

import { ConvertSummary } from "./components/convert-summary"
import { EpisodePickerDialog } from "./components/episode-picker-dialog"
import { OutputPanel } from "./components/output-panel"
import { includedFeatures } from "./lib"

export function ConvertPage() {
  const recordings = useRecordings()
  const [taskId, setTaskId] = useState<string>(TASKS[0].id)
  const task = getTask(taskId)
  const pool = recordings.filter((r) => r.taskId === taskId)
  const accepted = pool.filter((r) => r.review === "accepted")
  const pending = pool.filter((r) => r.review === "pending").length

  // Defaults to all accepted episodes; changing the task selects all again
  const [excluded, setExcluded] = useState<string[]>([])
  const [repoId, setRepoId] = useState(task?.repoId ?? "")
  const [pickerOpen, setPickerOpen] = useState(false)

  const changeTask = (id: string) => {
    setTaskId(id)
    setExcluded([])
    setRepoId(getTask(id)?.repoId ?? "")
  }

  const skip = new Set(excluded)
  const targets = accepted.filter((r) => !skip.has(r.id))
  // LeRobot has a single fps, so action is downsampled to the video fps (the source MCAP is kept as is)
  const fps = task?.videoFps ?? 30
  const actionHz = task?.actionHz ?? 60
  const included = includedFeatures(targets.length ? targets : accepted)
  const rig = task ? getRig(task.rigId) : undefined

  const preview = [
    `fps: ${fps}`,
    "features:",
    ...included.map((m) =>
      m.feature === "action" || m.feature === "observation.state"
        ? `  ${m.feature}: float32 [${rig?.joints.length ?? 6}]`
        : `  ${m.feature}: ${m.topic.kind === "video" ? "video" : m.topic.kind === "label" ? "int64" : "float32"}`,
    ),
    ...(task ? [`task: ${task.instruction}`] : []),
  ].join("\n")

  return (
    <Page title="Convert" description="Task 를 골라 승인된 MCAP 에피소드를 LeRobot 데이터셋으로 변환합니다.">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* ── Left: what to convert (task · episodes) ── */}
        <section className="flex min-h-0 flex-col gap-4">
          <Panel title="Task" className="@container flex-1 gap-4">
            <Select value={taskId} onValueChange={(v) => v && changeTask(v as string)}>
              <SelectTrigger aria-label="Task" className="h-9 w-full text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASKS.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="text-[13px]">
                    {t.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <dl className="divide-y">
              <div className="grid gap-1 pb-3">
                <dt className="text-xs text-muted-foreground">Label</dt>
                <dd className="text-[13px] leading-relaxed">{task?.instruction}</dd>
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
                    disabled={accepted.length === 0}
                    onClick={() => setPickerOpen(true)}
                    className="-mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-md px-2 py-1.5 text-[13px] transition-colors hover:bg-accent/60 disabled:pointer-events-none"
                  >
                    <span className="text-muted-foreground">Episodes</span>
                    <span className="flex items-center gap-1.5 tabular-nums">
                      {targets.length.toLocaleString()} of {accepted.length.toLocaleString()} accepted
                      <LuChevronRight className="size-3.5 text-muted-foreground" aria-hidden />
                    </span>
                  </button>
                </dd>
              </div>
            </dl>
            <ConvertSummary targets={targets} fps={fps} />
            {(accepted.length === 0 || pending > 0) && (
              <p className="text-xs text-muted-foreground">
                {accepted.length === 0 ? "승인된 에피소드가 없습니다. " : `검수를 기다리는 에피소드가 ${pending}개 있습니다. `}
                <Link to="/review" className="text-foreground underline underline-offset-4">
                  Review 에서 검수하기
                </Link>
              </p>
            )}
          </Panel>
        </section>

        {/* ── Right: result (output · convert) ── */}
        <section className="flex min-h-0 flex-col gap-4">
          <OutputPanel repoId={repoId} onRepoIdChange={setRepoId} fps={fps} actionHz={actionHz} preview={preview} count={targets.length} />
        </section>
      </div>

      {/* ── Episode picker. Keyed by task so its page resets when the task changes ── */}
      <EpisodePickerDialog
        key={taskId}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        taskId={task?.id}
        accepted={accepted}
        excluded={excluded}
        onExcludedChange={setExcluded}
      />
    </Page>
  )
}

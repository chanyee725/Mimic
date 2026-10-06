import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { LuPlus } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Panel } from "@/components/layout/page-layout"
import { ProgressRing } from "@/components/common/progress-ring"
import { SearchInput } from "@/components/common/search-input"
import { Segmented } from "@/components/common/segmented"
import { WorldMark } from "@/components/robot/world-mark"
import { useCaptureState } from "@/api/capture"
import { useRigs } from "@/api/rigs"
import { useSessions } from "@/api/sessions"
import { useCreateTask, useTasks } from "@/api/tasks"
import { capturingTaskId } from "@/domain/capture"
import { TASK_RING_TONE, taskWorld, type TaskWorld } from "@/domain/task"
import { plural } from "@/lib/format"
import { cn } from "@/lib/utils"

import { errorText, newTaskInput, successByTask } from "../lib"
import { ErrorNote, LoadingNote } from "@/components/common/query-state"
import { TaskIdDialog } from "./task-id-dialog"

export function TaskList({ selectedId }: { selectedId: string | undefined }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const [world, setWorld] = useState<TaskWorld | "all">("all")
  const [creating, setCreating] = useState(false)
  const q = query.trim().toLowerCase()
  const tasksQuery = useTasks()
  const sessions = useSessions()
  // REC follows the capture phase, not the task picked in Capture (that stays set after recording ends)
  const recTaskId = capturingTaskId(useCaptureState().data)
  const rig = useRigs().data?.[0]
  const create = useCreateTask()

  const allTasks = tasksQuery.data ?? []
  const countOf = (w: TaskWorld) => allTasks.filter((t) => taskWorld(t) === w).length
  const tasks = allTasks.filter(
    (t) =>
      (world === "all" || taskWorld(t) === world) &&
      (!q || t.id.includes(q) || t.name.toLowerCase().includes(q) || t.instruction.toLowerCase().includes(q)),
  )
  const success = useMemo(() => successByTask(sessions.data ?? []), [sessions.data])

  // Same tone as the app sidebar: no dividers, light text, only the selected row gets a background
  return (
    <Panel
      className="gap-2 p-3"
      title={
        <span className="flex items-baseline gap-1.5 px-2 text-[13px] font-medium">
          All tasks
          <span className="font-normal text-muted-foreground tabular-nums">{tasksQuery.data ? allTasks.length : ""}</span>
        </span>
      }
      action={
        <span className="flex items-center gap-1.5">
          <Segmented
            label="World"
            value={world}
            onChange={setWorld}
            options={[
              { value: "all", label: "All", count: tasksQuery.data && allTasks.length },
              { value: "real", label: <WorldMark world="real" />, count: tasksQuery.data && countOf("real") },
              { value: "sim", label: <WorldMark world="sim" />, count: tasksQuery.data && countOf("sim") },
            ]}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="New task"
            className="text-muted-foreground"
            disabled={!rig}
            title={rig ? "New task" : "Rig 가 없어 Task 를 만들 수 없습니다. config/rigs 에 rig 파일을 추가하세요."}
            onClick={() => {
              create.reset()
              setCreating(true)
            }}
          >
            <LuPlus />
          </Button>
        </span>
      }
    >
      <SearchInput
        className="px-1"
        aria-label="Search tasks"
        placeholder="Search tasks…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {tasksQuery.isError && <ErrorNote error={tasksQuery.error} onRetry={() => void tasksQuery.refetch()} />}
      <ul className="grid min-h-0 flex-1 content-start gap-0.5 overflow-y-auto">
        {tasksQuery.isPending && (
          <li>
            <LoadingNote />
          </li>
        )}
        {tasks.map((t) => {
          const selected = t.id === selectedId
          const recording = t.id === recTaskId
          const pct = Math.min(100, Math.round((t.collected / t.targetEpisodes) * 100))
          const stats = success.get(t.id) ?? { sessions: 0, success: null }
          return (
            <li key={t.id}>
              <button
                type="button"
                aria-current={selected ? "page" : undefined}
                onClick={() => navigate(`/tasks/${t.id}`)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent/60",
                  selected && "bg-accent hover:bg-accent",
                )}
              >
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className={cn("min-w-0 truncate text-[13px]", selected ? "font-medium" : "font-normal")}>{t.id}</span>
                    {recording && (
                      <span className="shrink-0 rounded-sm bg-bad-muted px-1 text-[10px] font-medium tracking-wide text-bad">REC</span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{t.instruction}</p>
                  <p className="truncate text-[11px] text-muted-foreground/80 tabular-nums">
                    {t.envId && `${t.envId} · `}
                    {t.collected}/{t.targetEpisodes} · {plural(stats.sessions, "session")} · success{" "}
                    {stats.success === null ? "—" : `${stats.success}%`}
                  </p>
                </div>
                <WorldMark world={taskWorld(t)} label />
                {/* A full ring turns black so finished tasks stand out */}
                <ProgressRing
                  pct={pct}
                  tone={pct >= 100 ? "foreground" : TASK_RING_TONE[t.status]}
                  label={`${t.id} progress`}
                  thin
                  className="size-10"
                  labelClassName={cn(pct >= 100 && "font-medium text-foreground")}
                />
              </button>
            </li>
          )
        })}
        {tasksQuery.isSuccess && tasks.length === 0 && (
          <li className="py-6 text-center text-[13px] text-muted-foreground">No tasks found.</li>
        )}
      </ul>

      <TaskIdDialog
        open={creating}
        onOpenChange={setCreating}
        title="New task"
        description="Draft 상태로 만들어지고, 나머지 설정은 만든 뒤 Definition 탭에서 고칩니다."
        initial={{ id: "", name: "" }}
        submitLabel="Create"
        pending={create.isPending}
        error={errorText(create.error)}
        onSubmit={({ id, name }) => {
          if (!rig) return
          create.mutate(newTaskInput(id, name, rig), {
            onSuccess: (task) => {
              setCreating(false)
              navigate(`/tasks/${task.id}`)
            },
          })
        }}
      />
    </Panel>
  )
}
